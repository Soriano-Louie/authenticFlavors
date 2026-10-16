import { pool } from '../db/pool.js';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

// Verification codes and reset links must not be persisted as readable text.
const key = createHash('sha256').update(`email-outbox:${env.jwtRefreshSecret}`).digest();
function seal(payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
}
function unseal(value) {
  const envelope = typeof value === 'string' ? JSON.parse(value) : value;
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  cipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(envelope.data, 'base64')), cipher.final()]).toString('utf8'));
}

export async function queueEmail(payload, lifetimeMinutes = 2880) {
  const [result] = await pool.query(`INSERT INTO email_outbox (payload, expires_at, next_attempt_at)
    VALUES (?, DATE_ADD(NOW(), INTERVAL ? MINUTE), DATE_ADD(NOW(), INTERVAL 5 MINUTE))`, [seal(payload), lifetimeMinutes]);
  return result.insertId;
}

export async function finishEmail(id) {
  await pool.query('DELETE FROM email_outbox WHERE outbox_id = ?', [id]);
}

let running = false;
export async function retryEmails(deliver) {
  if (running) return;
  running = true;
  try {
    await pool.query('DELETE FROM email_outbox WHERE expires_at <= NOW()');
    const [rows] = await pool.query(`SELECT outbox_id, payload FROM email_outbox
      WHERE next_attempt_at <= NOW() AND expires_at > NOW() ORDER BY outbox_id LIMIT 10`);
    for (const row of rows) {
      // Lease prevents normal requests and other worker instances from sending simultaneously.
      const [claim] = await pool.query(`UPDATE email_outbox SET next_attempt_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE),
        attempts = attempts + 1 WHERE outbox_id = ? AND next_attempt_at <= NOW()`, [row.outbox_id]);
      if (!claim.affectedRows) continue;
      try {
        const payload = unseal(row.payload);
        await deliver(payload.to, payload.subject, payload.htmlContent);
        await finishEmail(row.outbox_id);
      } catch (error) {
        console.error('Email delivery will be retried:', row.outbox_id, error.message);
      }
    }
  } finally {
    running = false;
  }
}
