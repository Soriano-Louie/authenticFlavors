import { pool } from "../db/pool.js";

/**
 * Creates an in-app notification in the database and optionally sends an email notification.
 * If email sending fails, the in-app notification is still saved and the error is logged resiliently.
 */
export async function createNotification({
  userId,
  bookingId = null,
  type,
  title,
  message,
  link = null,
  sendEmailFn = null,
}) {
  try {
    // 1. Insert notification into database
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, booking_id, type, title, message, link)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, bookingId, type, title, message, link],
    );

    const notificationId = result.insertId;

    // 2. Trigger optional email sending asynchronously (non-blocking failure)
    if (typeof sendEmailFn === "function") {
      sendEmailFn().catch((err) => {
        console.error(`[NotificationService] Email delivery failed for user ${userId} (${type}):`, err?.message || err);
      });
    }

    return { notificationId, success: true };
  } catch (error) {
    console.error("[NotificationService] Failed to create notification:", error);
    throw error;
  }
}
