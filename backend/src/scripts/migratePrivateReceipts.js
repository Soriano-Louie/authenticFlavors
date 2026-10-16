// Default is a dry run. --apply migrates only verified legacy receipt paths.
// No other media folders or customer-supplied arbitrary IDs are deleted.
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinaryService.js';

const apply = process.argv.includes('--apply');
try {
  const [rows] = await pool.query(`SELECT payment_id, receipt_url, receipt_public_id FROM payments
    WHERE receipt_url IS NOT NULL AND receipt_public_id LIKE 'authentic_flavors/receipts/%'`);
  const migratedSources = new Set();
  for (const row of rows) {
    try {
      const url = new URL(row.receipt_url);
      const suffix = url.pathname.match(/\/((?:authentic_flavors\/receipts\/)[^?]+)\.(jpg|jpeg|png|gif|webp)$/i);
      if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
          !url.pathname.startsWith(`/${env.cloudinaryCloudName}/image/upload/`) ||
          suffix?.[1] !== row.receipt_public_id) throw new Error('Asset ownership/path requires manual review');
      if (!apply) { console.log(`Eligible payment: ${row.payment_id}`); continue; }
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Source image unavailable');
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 5 * 1024 * 1024) throw new Error('Receipt exceeds size limit');
      const uploaded = await uploadToCloudinary(buffer, 'receipts');
      const [update] = await pool.query(`UPDATE payments SET receipt_url = ?, receipt_public_id = ?
        WHERE payment_id = ? AND receipt_url = ? AND receipt_public_id = ?`,
        [uploaded.secure_url, uploaded.public_id, row.payment_id, row.receipt_url, row.receipt_public_id]);
      if (!update.affectedRows) { await deleteFromCloudinary(uploaded.public_id); continue; }
      migratedSources.add(row.receipt_public_id);
      console.log(`Migrated payment: ${row.payment_id}`);
    } catch (error) { console.error(`Payment ${row.payment_id}: ${error.message}`); }
  }
  for (const id of migratedSources) {
    const [[remaining]] = await pool.query('SELECT COUNT(*) AS count FROM payments WHERE receipt_public_id = ?', [id]);
    if (Number(remaining.count) === 0) await deleteFromCloudinary(id);
  }
} finally { await pool.end(); }
