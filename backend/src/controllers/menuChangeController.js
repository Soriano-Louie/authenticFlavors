import { queueNotificationEmail } from "../services/emailService.js";
import { resolveMenu, repriceMenu, reconcileInstallments } from "../services/bookingRulesService.js";
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
  let connection;
  try {
    connection = await pool.getConnection();
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

    await connection.beginTransaction();

    // 1. Fetch booking details and verify ownership & status. The booking row
    // is locked (FOR UPDATE) so two simultaneous submissions for the same
    // booking line up behind the same lock and only one can pass the
    // "already pending" check below (race fix).
    const [bookings] = await connection.query(
      `SELECT b.*, u.first_name, u.last_name, u.email, p.package_name
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       JOIN packages p ON b.package_id = p.package_id
       WHERE b.booking_id = ? AND b.user_id = ? LIMIT 1 FOR UPDATE`,
      [bookingId, userId],
    );

    if (bookings.length === 0) {
      await connection?.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    // Status check: must be Reserved or Confirmed
    if (!["Confirmed", "Reserved"].includes(booking.booking_status)) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message:
            "Menu change requests are only allowed for active bookings (Reserved or Confirmed).",
        },
      });
    }

    // 14-day rule check (backend enforcement)
    const daysUntilEvent = getDaysUntilEvent(booking.event_date);
    if (daysUntilEvent < 14) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "MENU_CHANGE_RESTRICTED",
          message:
            "Menu changes are only allowed until 14 days before the scheduled event.",
        },
      });
    }

    await resolveMenu(connection, booking.package_id, menu_selections);

    // Check if there is already a pending request for this booking
    const [existingPending] = await connection.query(
      `SELECT request_id FROM menu_change_requests
       WHERE booking_id = ? AND status = 'Pending' LIMIT 1 FOR UPDATE`,
      [bookingId],
    );

    if (existingPending.length > 0) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "PENDING_REQUEST_EXISTS",
          message:
            "You already have a pending menu change request for this booking.",
        },
      });
    }

    // Check if requested menu and notes are identical to current booking
    const [currentMenuItems] = await connection.query(
      `SELECT mi.item_name FROM booking_menu_selections bms
       JOIN menu_items mi ON bms.menu_item_id = mi.menu_item_id
       WHERE bms.booking_id = ?`,
      [bookingId],
    );
    const currentItemNames = currentMenuItems.map((r) => r.item_name).sort();
    const requestedItemNames = [...menu_selections].sort();

    const itemsAreIdentical =
      currentItemNames.length === requestedItemNames.length &&
      currentItemNames.every((name, i) => name === requestedItemNames[i]);
    const currentDietaryNotes = (booking.dietary_notes || "").trim();
    const requestedDietaryNotes = (dietary_notes || "").trim();
    const notesAreIdentical = currentDietaryNotes === requestedDietaryNotes;

    if (itemsAreIdentical && notesAreIdentical) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "NO_CHANGES_DETECTED",
          message: "No changes were made to your menu selections or special requests.",
        },
      });
    }

    // Save menu change request
    const [result] = await connection.query(
      `INSERT INTO menu_change_requests (booking_id, user_id, requested_menu_selections, dietary_notes, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [
        bookingId,
        userId,
        JSON.stringify(menu_selections),
        dietary_notes ? dietary_notes.trim() : null,
      ],
    );

    const [admins] = await connection.query(
      "SELECT user_id, email FROM users WHERE role = 'Admin'",
    );

    const requestId = result.insertId;

    await logActivity({
      actorUserId: userId,
      actorRole: "Customer",
      activityType: "menu_change_requested",
      action: `requested a menu change for Booking #${(booking.booking_reference || `#${bookingId}`).replace(/^#/, "")}`,
      bookingId,
    }, connection);

    // Notify admins via in-app notification & email

    const customerName = `${booking.first_name} ${booking.last_name}`.trim();
    for (const admin of admins) {
      await createNotification({
        userId: admin.user_id,
        bookingId,
        type: "menu_change_requested",
        title: "New Menu Change Request",
        message: `Customer ${customerName} requested menu changes for booking ${booking.booking_reference || `#${bookingId}`}.`,
        link: `/admin`,
      }, connection);

      await queueNotificationEmail(connection, () => sendMenuChangeRequestedAdminEmail(admin.email, {
          booking_reference: booking.booking_reference || `#${bookingId}`,
          customer_name: customerName,
          event_date: booking.event_date,
          requested_items: menu_selections,
        }));

    }

    await connection.commit();

    res.status(201).json({
      message: "Menu change request submitted successfully.",
      request_id: requestId,
    });
  } catch (error) {
    await connection?.rollback();
    if (error.status && error.status < 500) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    next(error);
  } finally {
    connection?.release();
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
      `SELECT mcr.*,
              (
                SELECT JSON_ARRAYAGG(mi.item_name)
                FROM booking_menu_selections bms
                JOIN menu_items mi ON bms.menu_item_id = mi.menu_item_id
                WHERE bms.booking_id = mcr.booking_id
              ) AS current_menu_selections
       FROM menu_change_requests mcr
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
              p.package_name, u.first_name, u.last_name, u.email,
              (
                SELECT JSON_ARRAYAGG(mi.item_name)
                FROM booking_menu_selections bms
                JOIN menu_items mi ON bms.menu_item_id = mi.menu_item_id
                WHERE bms.booking_id = b.booking_id
              ) AS current_menu_selections
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
  let connection;
  try {
    connection = await pool.getConnection();
    const requestId = Number(req.params.requestId);
    const adminId = Number(req.auth.sub);

    await connection.beginTransaction();

    // Fetch request details
    const [requests] = await connection.query(
      `SELECT mcr.*, b.booking_reference, b.event_date, b.booking_status,
              b.package_id, b.dietary_notes as current_dietary_notes,
              b.number_of_pax, b.total_price, b.amount_paid, b.booking_summary,
              u.user_id, u.first_name, u.last_name, u.email
       FROM menu_change_requests mcr
       JOIN bookings b ON mcr.booking_id = b.booking_id
       JOIN users u ON mcr.user_id = u.user_id
       WHERE mcr.request_id = ? LIMIT 1 FOR UPDATE`,
      [requestId],
    );

    if (requests.length === 0) {
      await connection?.rollback();
      return res
        .status(404)
        .json({ error: { message: "Menu change request not found." } });
    }

    const request = requests[0];
    if (request.status !== "Pending") {
      await connection?.rollback();
      return res.status(400).json({
        error: { message: `Request is already ${request.status.toLowerCase()}.` },
      });
    }

    // Re-verify the booking is still confirmed and still 14+ days out. The
    // situation can change between when the customer submits and when the admin
    // clicks approve (booking cancelled, event too close) — refusing here keeps
    // the change from being applied to a booking that no longer qualifies.
    // The booking row was locked FOR UPDATE above, so this check is race-safe.
    if (!["Confirmed", "Reserved"].includes(request.booking_status)) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "MENU_CHANGE_RESTRICTED",
          message:
            "Menu changes can only be approved for active bookings (Reserved or Confirmed).",
        },
      });
    }
    const daysUntilEvent = getDaysUntilEvent(request.event_date);
    if (daysUntilEvent < 14) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "MENU_CHANGE_RESTRICTED",
          message:
            "Menu changes are only allowed until 14 days before the scheduled event. This event is now too close.",
        },
      });
    }

    const newSelectionsRaw =
      typeof request.requested_menu_selections === "string"
        ? JSON.parse(request.requested_menu_selections)
        : request.requested_menu_selections;

    // The item list must never be empty at approval time — wiping the whole
    // menu on an empty request is a data-loss bug, so reject it explicitly.
    if (!Array.isArray(newSelectionsRaw) || newSelectionsRaw.length === 0) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "The requested menu selections list is empty. Ask the customer to resubmit the request with at least one item.",
        },
      });
    }

    const resolved = await resolveMenu(connection, request.package_id, newSelectionsRaw);
    const newSelections = resolved.map(item => item.item_name);
    const summary = typeof request.booking_summary === 'string'
      ? JSON.parse(request.booking_summary) : (request.booking_summary || {});
    const repriced = repriceMenu(summary.pricing_snapshot, resolved);
    const [oldSelectionsRows] = await connection.query(
      `SELECT mi.item_name FROM booking_menu_selections bms JOIN menu_items mi
       ON mi.menu_item_id = bms.menu_item_id WHERE bms.booking_id = ?`, [request.booking_id]);
    const oldSelections = oldSelectionsRows.map(item => item.item_name);
    const [payments] = await connection.query(
      "SELECT * FROM payments WHERE booking_id = ? AND payment_type != 'CancellationCharge' ORDER BY FIELD(payment_type, 'Reservation', 'DownPayment', 'FinalPayment'), payment_id FOR UPDATE", [request.booking_id]);
    const plan = reconcileInstallments(payments, repriced.total);
    const oldTotal = Number(request.total_price);
    const newTotal = repriced.total;
    const newRemaining = plan.remaining;
    await connection.query('DELETE FROM booking_menu_selections WHERE booking_id = ?', [request.booking_id]);
    for (const item of resolved) {
      await connection.query('INSERT INTO booking_menu_selections (booking_id, category_id, menu_item_id) VALUES (?, ?, ?)',
        [request.booking_id, item.category_id, item.menu_item_id]);
    }
    for (const change of plan.changes) {
      await connection.query(`UPDATE payments SET amount = ?, payment_status = CASE WHEN ? = 0 THEN 'Cancelled' ELSE payment_status END,
        updated_at = NOW() WHERE payment_id = ?`, [change.amount, change.amount, change.payment_id]);
    }
    if (plan.newFinal > 0) {
      await connection.query(`INSERT INTO payments (booking_id, payment_type, amount, due_date, payment_status)
        VALUES (?, 'FinalPayment', ?, ?, 'Pending')`, [request.booking_id, plan.newFinal, request.event_date]);
    }
    summary.pricing_snapshot = repriced.snapshot;
    summary.menu_choices_names = newSelections;
    summary.overpayment_credit = plan.credit;
    await connection.query(`UPDATE bookings SET total_price = ?, amount_paid = ?, remaining_balance = ?,
      original_total = ?, discount_amount = ?, booking_summary = ?, dietary_notes = ?, updated_at = NOW() WHERE booking_id = ?`,
      [newTotal, plan.paid, newRemaining, repriced.original, repriced.reduction, JSON.stringify(summary),
       request.dietary_notes ?? request.current_dietary_notes, request.booking_id]);

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
          total_price: oldTotal,
        }),
        JSON.stringify({
          menu_selections: newSelections,
          dietary_notes: request.dietary_notes || request.current_dietary_notes,
          total_price: newTotal,
          remaining_balance: newRemaining,
        }),
        adminId,
      ],
    );

    await logActivity({
      actorUserId: adminId,
      actorRole: "Admin",
      activityType: "menu_change_approved",
      action: `approved the menu change for Booking #${(request.booking_reference || `#${request.booking_id}`).replace(/^#/, "")}`,
      bookingId: request.booking_id,
    }, connection);

    // In-app notification to customer
    await createNotification({
      userId: request.user_id,
      bookingId: request.booking_id,
      type: "menu_change_approved",
      title: "Menu Change Approved",
      message: `Your requested menu changes for booking ${request.booking_reference || `#${request.booking_id}`} have been approved!`,
      link: `/dashboard`,
    }, connection);

    // Email notification to customer

    await queueNotificationEmail(connection, () => sendMenuChangeApprovedCustomerEmail(request.email, request.first_name, {
          booking_reference: request.booking_reference || `#${request.booking_id}`,
          event_date: request.event_date,
          updated_items: newSelections,
        }));

    await connection.commit();

    res.json({ message: "Menu change request approved successfully." });
  } catch (error) {
    await connection?.rollback();
    if (error.status && error.status < 500) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    next(error);
  } finally {
    connection?.release();
  }
}

/**
 * POST /api/admin/menu-change-requests/:requestId/reject
 * Admin rejects a menu change request with required reason.
 */
export async function rejectMenuChangeRequest(req, res, next) {
  let connection;
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

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Fetch request details
    const [requests] = await connection.query(
      `SELECT mcr.*, b.booking_reference, b.event_date, u.user_id, u.first_name, u.email
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

    // Update request status to Rejected
    await connection.query(
      `UPDATE menu_change_requests
       SET status = 'Rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [rejection_reason.trim(), adminId, requestId],
    );

    await logActivity({
      actorUserId: adminId,
      actorRole: "Admin",
      activityType: "menu_change_rejected",
      action: `rejected the menu change for Booking #${(request.booking_reference || `#${request.booking_id}`).replace(/^#/, "")}`,
      bookingId: request.booking_id,
    }, connection);

    // In-app notification to customer
    await createNotification({
      userId: request.user_id,
      bookingId: request.booking_id,
      type: "menu_change_rejected",
      title: "Menu Change Request Update",
      message: `Your menu change request for booking ${request.booking_reference || `#${request.booking_id}`} was declined. Reason: ${rejection_reason.trim()}`,
      link: `/dashboard`,
    }, connection);

    // Email notification to customer

    await queueNotificationEmail(connection, () => sendMenuChangeRejectedCustomerEmail(request.email, request.first_name, {
          booking_reference: request.booking_reference || `#${request.booking_id}`,
          event_date: request.event_date,
        }, rejection_reason.trim()));

    await connection.commit();
    res.json({ message: "Menu change request rejected successfully." });
  } catch (error) {
    await connection?.rollback();
    next(error);
  } finally {
    connection?.release();
  }
}
