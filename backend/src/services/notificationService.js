import { pool } from "../db/pool.js";
import { queueNotificationEmail } from "./emailService.js";

/**
 * With a transaction connection, save the alert and rendered email job together
 * and propagate failures so the caller rolls back its business change.
 * Standalone callers retain best-effort notification behavior.
 */
export async function createNotification({
  userId,
  user_id,
  bookingId,
  booking_id,
  type,
  title,
  message,
  link = null,
  sendEmailFn = null,
}, connection = null) {
  const finalUserId = userId !== undefined ? userId : user_id;
  const finalBookingId = bookingId !== undefined ? bookingId : (booking_id ?? null);
  try {
    // 1. Insert notification into database
    const [result] = await (connection || pool).query(
      `INSERT INTO notifications (user_id, booking_id, type, title, message, link)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [finalUserId, finalBookingId, type, title, message, link],
    );

    const notificationId = result.insertId;

    // Transactional callers only queue mail; the scheduler delivers after commit.
    if (typeof sendEmailFn === "function") {
      if (connection) {
        await queueNotificationEmail(connection, sendEmailFn);
      } else {
        await sendEmailFn().catch((err) => {
          console.error(`[NotificationService] Email delivery failed for user ${userId} (${type}):`, err?.message || err);
        });
      }
    }

    return { notificationId, success: true };
  } catch (error) {
    // A transaction must roll back if either its alert or email job cannot be saved.
    if (connection) throw error;
    console.error("[NotificationService] Failed to create notification:", error);
    return { success: false, notificationId: null };
  }
}
