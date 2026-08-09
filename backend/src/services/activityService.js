import { pool } from "../db/pool.js";
import { getPhilippineDateTimeString } from "../utils/timezone.js";

/**
 * Resolves the display name for a user. Caches lookups per request to avoid
 * repeated queries when multiple activities are logged in one flow.
 */
const nameCache = new Map();

export function clearNameCache() {
  nameCache.clear();
}

export async function getUserName(userId) {
  if (!userId) {
    return "Admin";
  }
  if (nameCache.has(userId)) {
    return nameCache.get(userId);
  }
  const [rows] = await pool.query(
    "SELECT first_name, last_name FROM users WHERE user_id = ?",
    [userId]
  );
  const row = rows[0];
  const name = row ? `${row.first_name} ${row.last_name}`.trim() : "Unknown";
  nameCache.set(userId, name);
  return name;
}

/**
 * Records a single activity log entry shown in the admin Recent Activity feed.
 *
 * @param {object} params
 * @param {number|null} params.actorUserId  - user who performed the action
 * @param {string}     params.actorRole     - "Admin" | "Customer"
 * @param {string}     params.activityType  - machine readable category (e.g. "booking_confirmed")
 * @param {string}     params.action        - verb phrase after the actor name,
 *                                            e.g. "confirmed Booking #BK-123456"
 * @param {string}     [params.bookingId]   - related booking primary key (for FK + backfill)
 */
export async function logActivity({
  actorUserId,
  actorRole = "Admin",
  activityType,
  action,
  bookingId = null,
}) {
  if (!activityType || !action) {
    return;
  }
  const actorName = await getUserName(actorUserId);
  const [result] = await pool.query(
    `INSERT INTO activity_logs
      (actor_user_id, actor_name, actor_role, activity_type, action, booking_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      actorUserId ?? null,
      actorName,
      actorRole,
      activityType,
      action,
      bookingId,
      getPhilippineDateTimeString(),
    ]
  );
  return result.insertId;
}
