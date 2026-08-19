import cron from "node-cron";
import { pool } from "../db/pool.js";

// ─── Relationship-driven cleanup ─────────────────────────────────────────────
// Fixes stale ai_conversations / ai_booking_sessions rows:
//   1. Conversations whose booking was cancelled  -> Cancelled
//   2. Conversations that produced a booking      -> Completed
//   3. Conversations abandoned mid-chat (no booking, stale) -> Cancelled
//   4. Sessions mirror their conversation's status
// This is the same logic as .kilo/cleanup_ai_sessions.sql, exposed as a
// reusable service so it can run on a schedule (self-healing).
export async function runSessionCleanup() {
  // ── 1. Fix ai_conversations ────────────────────────────────────────────
  // 1a. Booking was cancelled -> conversation Cancelled
  await pool.query(
    `UPDATE ai_conversations c
     JOIN bookings b ON b.booking_id = c.booking_id
     SET c.conversation_status = 'Cancelled',
         c.ended_at = COALESCE(c.ended_at, CURRENT_TIMESTAMP)
     WHERE c.conversation_status = 'Active'
       AND b.booking_status = 'Cancelled'`,
  );

  // 1b. A booking was created through the chat -> conversation Completed
  await pool.query(
    `UPDATE ai_conversations
     SET conversation_status = 'Completed',
         ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
     WHERE conversation_status = 'Active'
       AND booking_id IS NOT NULL`,
  );

  // 1c. Abandoned mid-chat: no booking & stale -> conversation Cancelled.
  // "Stale" is based on the LAST activity (latest message) rather than the
  // conversation's started_at, so an active multi-day chat is never wiped.
  await pool.query(
    `UPDATE ai_conversations c
     LEFT JOIN (
       SELECT conversation_id, MAX(sent_at) AS last_sent_at
       FROM ai_messages
       GROUP BY conversation_id
     ) m ON m.conversation_id = c.conversation_id
     SET c.conversation_status = 'Cancelled',
         c.ended_at = COALESCE(c.ended_at, CURRENT_TIMESTAMP)
     WHERE c.conversation_status = 'Active'
       AND c.booking_id IS NULL
       AND COALESCE(m.last_sent_at, c.started_at) < CURRENT_TIMESTAMP - INTERVAL 1 DAY`,
  );

  // ── 2. Fix ai_booking_sessions (mirror the conversations) ──────────────
  // 2a. Completed conversation / booking exists -> session Completed
  await pool.query(
    `UPDATE ai_booking_sessions s
     JOIN ai_conversations c USING (conversation_id)
     SET s.session_status = 'Completed'
     WHERE s.session_status = 'InProgress'
       AND (c.conversation_status = 'Completed' OR c.booking_id IS NOT NULL)`,
  );

  // 2b. Cancelled conversation / cancelled booking / stale abandoned -> session Cancelled
  await pool.query(
    `UPDATE ai_booking_sessions s
     JOIN ai_conversations c USING (conversation_id)
     LEFT JOIN bookings b ON b.booking_id = c.booking_id
     SET s.session_status = 'Cancelled'
     WHERE s.session_status = 'InProgress'
       AND (c.conversation_status = 'Cancelled'
            OR b.booking_status = 'Cancelled'
            OR (c.booking_id IS NULL AND s.last_updated < CURRENT_TIMESTAMP - INTERVAL 1 DAY))`,
  );
}

// ─── Status counts (for verification / reporting) ────────────────────────────
export async function getSessionStatusCounts() {
  const [conversations] = await pool.query(
    `SELECT conversation_status, COUNT(*) AS cnt
     FROM ai_conversations
     GROUP BY conversation_status`,
  );
  const [sessions] = await pool.query(
    `SELECT session_status, COUNT(*) AS cnt
     FROM ai_booking_sessions
     GROUP BY session_status`,
  );
  return { conversations, sessions };
}

// ─── Hourly scheduler (self-healing) ─────────────────────────────────────────
// Runs every hour. Safe to run repeatedly — the UPDATEs are idempotent.
export function startSessionCleanupScheduler() {
  const task = cron.schedule(
    "0 * * * *",
    async () => {
      try {
        await runSessionCleanup();
        console.log(
          "[SessionCleanup] Hourly cleanup completed at",
          new Date().toISOString(),
        );
      } catch (error) {
        console.error("[SessionCleanup] Hourly cleanup failed:", error);
      }
    },
    { timezone: "Asia/Manila" },
  );
  return task;
}
