import { pool } from "../db/pool.js";

/**
 * GET /api/notifications
 * Retrieves all notifications for the authenticated user in reverse chronological order (newest first).
 */
export async function getUserNotifications(req, res, next) {
  try {
    const userId = req.user.user_id;

    const [notifications] = await pool.query(
      `SELECT notification_id, user_id, booking_id, type, title, message, is_read, link, created_at, read_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId],
    );

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    res.json({
      notifications,
      unread_count: unreadCount,
      total_count: notifications.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Marks a specific notification as read.
 */
export async function markAsRead(req, res, next) {
  try {
    const userId = req.user.user_id;
    const notificationId = req.params.id;

    const [result] = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE notification_id = ? AND user_id = ?`,
      [notificationId, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Notification not found." });
    }

    res.json({ success: true, message: "Notification marked as read." });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/notifications/read-all
 * Marks all notifications for the authenticated user as read.
 */
export async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.user_id;

    await pool.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE user_id = ? AND is_read = FALSE`,
      [userId],
    );

    res.json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/notifications/:id
 * Deletes a specific notification.
 */
export async function deleteNotification(req, res, next) {
  try {
    const userId = req.user.user_id;
    const notificationId = req.params.id;

    const [result] = await pool.query(
      "DELETE FROM notifications WHERE notification_id = ? AND user_id = ?",
      [notificationId, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Notification not found." });
    }

    res.json({ success: true, message: "Notification deleted." });
  } catch (error) {
    next(error);
  }
}
