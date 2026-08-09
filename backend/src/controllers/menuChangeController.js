import { pool } from "../db/pool.js";
import { getPhilippineDateString } from "../utils/timezone.js";
import { createNotification } from "../services/notificationService.js";
import { logActivity } from "../services/activityService.js";
import {
  sendMenuChangeRequestedAdminEmail,
  sendMenuChangeApprovedCustomerEmail,
  sendMenuChangeRejectedCustomerEmail,
} from "../services/emailService.js";

/**
 * Calculate difference in calendar days between today (Philippine time) and target date.
 */
function getDaysUntilEvent(eventDateStr) {
  const todayStr = getPhilippineDateString(); // YYYY-MM-DD
  const today = new Date(todayStr);
  const target = new Date(
    typeof eventDateStr === "string"
      ? eventDateStr.split("T")[0]
      : eventDateStr,
  );
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * POST /api/bookings/:id/menu-change
 * Customer submits a menu change request.
 */
export async function requestMenuChange(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    const userId = Number(req.auth.sub);
    const { menu_selections, dietary_notes } = req.body;

    if (!Array.isArray(menu_selections) || menu_selections.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Requested menu selections are required.",
        },
      });
    }

    // 1. Fetch booking details and verify ownership & status
    const [bookings] = await pool.query(
      `SELECT b.*, u.first_name, u.last_name, u.email, p.package_name
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       JOIN packages p ON b.package_id = p.package_id
       WHERE b.booking_id = ? AND b.user_id = ? LIMIT 1`,
      [bookingId, userId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    // Status check: must be Confirmed
    if (booking.booking_status !== "Confirmed") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message:
            "Menu change requests are only allowed for confirmed bookings.",
        },
      });
    }

    // 14-day rule check (backend enforcement)
    const daysUntilEvent = getDaysUntilEvent(booking.event_date);
    if (daysUntilEvent < 14) {
      return res.status(400).json({
        error: {
          code: "MENU_CHANGE_RESTRICTED",
          message:
            "Menu changes are only allowed until 14 days before the scheduled event.",
        },
      });
    }

    // Check if there is already a pending request for this booking
    const [existingPending] = await pool.query(
      `SELECT request_id FROM menu_change_requests
       WHERE booking_id = ? AND status = 'Pending' LIMIT 1`,
      [bookingId],
    );

    if (existingPending.length > 0) {
      return res.status(400).json({
        error: {
          code: "PENDING_REQUEST_EXISTS",
          message:
            "You already have a pending menu change request for this booking.",
        },
      });
    }

    // Save menu change request
    const [result] = await pool.query(
      `INSERT INTO menu_change_requests (booking_id, user_id, requested_menu_selections, dietary_notes, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [
        bookingId,
        userId,
        JSON.stringify(menu_selections),
        dietary_notes ? dietary_notes.trim() : null,
      ],
    );

    const requestId = result.insertId;

    logActivity({
      actorUserId: userId,
      actorRole: "Customer",
      activityType: "menu_change_requested",
      action: `requested a menu change for Booking #${(booking.booking_reference || `#${bookingId}`).replace(/^#/, "")}`,
      bookingId,
    }).catch((err) =>
      console.error("Activity logging failed (menu_change_requested):", err),
    );

    // Notify admins via in-app notification & email
    const [admins] = await pool.query(
      "SELECT user_id, email FROM users WHERE role = 'Admin'",
    );

    const customerName = `${booking.first_name} ${booking.last_name}`.trim();
    for (const admin of admins) {
      await createNotification({
        user_id: admin.user_id,
        booking_id: bookingId,
        type: "menu_change_requested",
        title: "New Menu Change Request",
        message: `Customer ${customerName} requested menu changes for booking ${booking.booking_reference || `#${bookingId}`}.`,
        link: `/admin`,
      });

      try {
        await sendMenuChangeRequestedAdminEmail(admin.email, {
          booking_reference: booking.booking_reference || `#${bookingId}`,
          customer_name: customerName,
          event_date: booking.event_date,
          requested_items: menu_selections,
        });
      } catch (e) {
        console.error("Failed to send admin menu change email:", e.message);
      }
    }

    res.status(201).json({
      message: "Menu change request submitted successfully.",
      request_id: requestId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bookings/:id/menu-change-requests
 * Get menu change requests for a specific booking.
 */
export async function getBookingMenuChangeRequests(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    const userId = Number(req.auth.sub);
    const userRole = req.auth.role;

    // Verify access
    if (userRole !== "Admin") {
      const [ownerCheck] = await pool.query(
        "SELECT booking_id FROM bookings WHERE booking_id = ? AND user_id = ? LIMIT 1",
        [bookingId, userId],
      );
      if (ownerCheck.length === 0) {
        return res
          .status(403)
          .json({ error: { code: "FORBIDDEN", message: "Access denied." } });
      }
    }

    const [requests] = await pool.query(
      `SELECT * FROM menu_change_requests
       WHERE booking_id = ?
       ORDER BY created_at DESC`,
      [bookingId],
    );

    res.json({ requests });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/menu-change-requests
 * Fetch all pending and past menu change requests for Admin.
 */
export async function getAdminMenuChangeRequests(req, res, next) {
  try {
    const [requests] = await pool.query(
      `SELECT mcr.*, b.booking_reference, b.event_date, b.booking_status,
              p.package_name, u.first_name, u.last_name, u.email
       FROM menu_change_requests mcr
       JOIN bookings b ON mcr.booking_id = b.booking_id
       JOIN packages p ON b.package_id = p.package_id
       JOIN users u ON mcr.user_id = u.user_id
       ORDER BY mcr.created_at DESC`,
    );

    res.json({ requests });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/menu-change-requests/:requestId/approve
 * Admin approves a menu change request.
 */
export async function approveMenuChangeRequest(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const requestId = Number(req.params.requestId);
    const adminId = Number(req.auth.sub);

    await connection.beginTransaction();

    // Fetch request details
    const [requests] = await connection.query(
      `SELECT mcr.*, b.booking_reference, b.event_date, b.package_id, b.dietary_notes as current_dietary_notes,
              u.user_id, u.first_name, u.last_name, u.email
       FROM menu_change_requests mcr
       JOIN bookings b ON mcr.booking_id = b.booking_id
       JOIN users u ON mcr.user_id = u.user_id
       WHERE mcr.request_id = ? LIMIT 1 FOR UPDATE`,
      [requestId],
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ error: { message: "Menu change request not found." } });
    }

    const request = requests[0];
    if (request.status !== "Pending") {
      await connection.rollback();
      return res.status(400).json({
        error: { message: `Request is already ${request.status.toLowerCase()}.` },
      });
    }

    const newSelections =
      typeof request.requested_menu_selections === "string"
        ? JSON.parse(request.requested_menu_selections)
        : request.requested_menu_selections;

    // Fetch current menu selections for auditing
    const [oldSelectionsRows] = await connection.query(
      `SELECT mi.item_name FROM booking_menu_selections bms
       JOIN menu_items mi ON bms.menu_item_id = mi.menu_item_id
       WHERE bms.booking_id = ?`,
      [request.booking_id],
    );
    const oldSelections = oldSelectionsRows.map((r) => r.item_name);

    // Delete existing menu selections for booking and re-insert approved new selections
    await connection.query(
      "DELETE FROM booking_menu_selections WHERE booking_id = ?",
      [request.booking_id],
    );

    for (const itemName of newSelections) {
      const [menuItems] = await connection.query(
        "SELECT menu_item_id, category_id FROM menu_items WHERE item_name = ? LIMIT 1",
        [itemName],
      );

      if (menuItems.length > 0) {
        await connection.query(
          `INSERT INTO booking_menu_selections (booking_id, category_id, menu_item_id)
           VALUES (?, ?, ?)`,
          [
            request.booking_id,
            menuItems[0].category_id,
            menuItems[0].menu_item_id,
          ],
        );
      }
    }

    // Update dietary notes on booking if provided in request
    if (request.dietary_notes) {
      await connection.query(
        "UPDATE bookings SET dietary_notes = ? WHERE booking_id = ?",
        [request.dietary_notes, request.booking_id],
      );
    }

    // Update request status to Approved
    await connection.query(
      `UPDATE menu_change_requests
       SET status = 'Approved', reviewed_by = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [adminId, requestId],
    );

    // Record in booking_history for auditing
    await connection.query(
      `INSERT INTO booking_history (booking_id, change_type, description, previous_state, new_state, changed_by)
       VALUES (?, 'MENU_CHANGE_APPROVED', ?, ?, ?, ?)`,
      [
        request.booking_id,
        `Menu change request #${requestId} approved by admin.`,
        JSON.stringify({
          menu_selections: oldSelections,
          dietary_notes: request.current_dietary_notes,
        }),
        JSON.stringify({
          menu_selections: newSelections,
          dietary_notes: request.dietary_notes || request.current_dietary_notes,
        }),
        adminId,
      ],
    );

    await connection.commit();

    logActivity({
      actorUserId: adminId,
      actorRole: "Admin",
      activityType: "menu_change_approved",
      action: `approved the menu change for Booking #${(request.booking_reference || `#${request.booking_id}`).replace(/^#/, "")}`,
      bookingId: request.booking_id,
    }).catch((err) =>
      console.error("Activity logging failed (menu_change_approved):", err),
    );

    // In-app notification to customer
    await createNotification({
      user_id: request.user_id,
      booking_id: request.booking_id,
      type: "menu_change_approved",
      title: "Menu Change Approved",
      message: `Your requested menu changes for booking ${request.booking_reference || `#${request.booking_id}`} have been approved!`,
      link: `/dashboard`,
    });

    // Email notification to customer
    try {
      await sendMenuChangeApprovedCustomerEmail(
        request.email,
        request.first_name,
        {
          booking_reference: request.booking_reference || `#${request.booking_id}`,
          event_date: request.event_date,
          updated_items: newSelections,
        },
      );
    } catch (e) {
      console.error("Failed to send customer menu change approval email:", e.message);
    }

    res.json({ message: "Menu change request approved successfully." });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * POST /api/admin/menu-change-requests/:requestId/reject
 * Admin rejects a menu change request with required reason.
 */
export async function rejectMenuChangeRequest(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    const adminId = Number(req.auth.sub);
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Rejection reason is required.",
        },
      });
    }

    // Fetch request details
    const [requests] = await pool.query(
      `SELECT mcr.*, b.booking_reference, b.event_date, u.user_id, u.first_name, u.email
       FROM menu_change_requests mcr
       JOIN bookings b ON mcr.booking_id = b.booking_id
       JOIN users u ON mcr.user_id = u.user_id
       WHERE mcr.request_id = ? LIMIT 1`,
      [requestId],
    );

    if (requests.length === 0) {
      return res
        .status(404)
        .json({ error: { message: "Menu change request not found." } });
    }

    const request = requests[0];
    if (request.status !== "Pending") {
      return res.status(400).json({
        error: { message: `Request is already ${request.status.toLowerCase()}.` },
      });
    }

    // Update request status to Rejected
    await pool.query(
      `UPDATE menu_change_requests
       SET status = 'Rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [rejection_reason.trim(), adminId, requestId],
    );

    logActivity({
      actorUserId: adminId,
      actorRole: "Admin",
      activityType: "menu_change_rejected",
      action: `rejected the menu change for Booking #${(request.booking_reference || `#${request.booking_id}`).replace(/^#/, "")}`,
      bookingId: request.booking_id,
    }).catch((err) =>
      console.error("Activity logging failed (menu_change_rejected):", err),
    );

    // In-app notification to customer
    await createNotification({
      user_id: request.user_id,
      booking_id: request.booking_id,
      type: "menu_change_rejected",
      title: "Menu Change Request Update",
      message: `Your menu change request for booking ${request.booking_reference || `#${request.booking_id}`} was declined. Reason: ${rejection_reason.trim()}`,
      link: `/dashboard`,
    });

    // Email notification to customer
    try {
      await sendMenuChangeRejectedCustomerEmail(
        request.email,
        request.first_name,
        {
          booking_reference: request.booking_reference || `#${request.booking_id}`,
          event_date: request.event_date,
        },
        rejection_reason.trim(),
      );
    } catch (e) {
      console.error("Failed to send customer menu change rejection email:", e.message);
    }

    res.json({ message: "Menu change request rejected successfully." });
  } catch (error) {
    next(error);
  }
}
