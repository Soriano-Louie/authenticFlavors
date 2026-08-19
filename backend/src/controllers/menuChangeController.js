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
  const connection = await pool.getConnection();
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
      await connection.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    // Status check: must be Reserved or Confirmed
    if (!["Confirmed", "Reserved"].includes(booking.booking_status)) {
      await connection.rollback();
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
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "MENU_CHANGE_RESTRICTED",
          message:
            "Menu changes are only allowed until 14 days before the scheduled event.",
        },
      });
    }

    // Check that at most 1 item is selected per category
    if (menu_selections.length > 0) {
      const placeholders = menu_selections.map(() => "?").join(",");
      const [itemsWithCategories] = await connection.query(
        `SELECT mi.item_name, mi.category_id, mc.category_name
         FROM menu_items mi
         JOIN menu_categories mc ON mi.category_id = mc.category_id
         WHERE mi.item_name IN (${placeholders})`,
        menu_selections,
      );
      const seenCategories = new Map();
      for (const item of itemsWithCategories) {
        if (seenCategories.has(item.category_id)) {
          await connection.rollback();
          return res.status(400).json({
            error: {
              code: "VALIDATION_ERROR",
              message: `Only 1 selection is allowed for category '${item.category_name}'.`,
            },
          });
        }
        seenCategories.set(item.category_id, item.item_name);
      }
    }

    // Check if there is already a pending request for this booking
    const [existingPending] = await connection.query(
      `SELECT request_id FROM menu_change_requests
       WHERE booking_id = ? AND status = 'Pending' LIMIT 1 FOR UPDATE`,
      [bookingId],
    );

    if (existingPending.length > 0) {
      await connection.rollback();
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
      await connection.rollback();
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

    await connection.commit();

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
        userId: admin.user_id,
        bookingId,
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
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
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
  const connection = await pool.getConnection();
  try {
    const requestId = Number(req.params.requestId);
    const adminId = Number(req.auth.sub);

    await connection.beginTransaction();

    // Fetch request details
    const [requests] = await connection.query(
      `SELECT mcr.*, b.booking_reference, b.event_date, b.booking_status,
              b.package_id, b.dietary_notes as current_dietary_notes,
              b.number_of_pax, b.total_price, b.amount_paid,
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

    // Re-verify the booking is still confirmed and still 14+ days out. The
    // situation can change between when the customer submits and when the admin
    // clicks approve (booking cancelled, event too close) — refusing here keeps
    // the change from being applied to a booking that no longer qualifies.
    // The booking row was locked FOR UPDATE above, so this check is race-safe.
    if (!["Confirmed", "Reserved"].includes(request.booking_status)) {
      await connection.rollback();
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
      await connection.rollback();
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
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "The requested menu selections list is empty. Ask the customer to resubmit the request with at least one item.",
        },
      });
    }

    // De-duplicate the requested items (case-insensitive) so an item listed
    // twice can't double-count its additional_price or crash on the unique key.
    const newSelections = [
      ...new Set(
        newSelectionsRaw
          .map((s) => String(s).trim())
          .filter((s) => s.length > 0),
      ),
    ];

    // Fetch current menu selections for auditing and to recover the package
    // base price the customer actually booked at. The old total is priced as
    // base + additional, so base = oldTotal − sum(old additional prices). The
    // re-approval then uses that original base — never the package's current
    // tier — so a price change since booking can't skew the surcharge.
    const [oldSelectionsRows] = await connection.query(
      `SELECT mi.item_name, mi.additional_price FROM booking_menu_selections bms
       JOIN menu_items mi ON bms.menu_item_id = mi.menu_item_id
       JOIN menu_categories mc ON bms.category_id = mc.category_id
       WHERE bms.booking_id = ?`,
      [request.booking_id],
    );
    const oldSelections = oldSelectionsRows.map((r) => r.item_name);
    const oldAdditionalSum = oldSelectionsRows.reduce(
      (sum, row) => sum + parseFloat(row.additional_price || 0),
      0,
    );

    // Delete existing menu selections for booking and re-insert approved new selections
    await connection.query(
      "DELETE FROM booking_menu_selections WHERE booking_id = ?",
      [request.booking_id],
    );

    // Accumulate the additional price of the approved items while re-inserting.
    // Only items from still-active menu categories are accepted, so a disabled
    // category can never have its items silently re-added through an approval.
    let additionalPriceSum = 0;
    for (const itemName of newSelections) {
      const [menuItems] = await connection.query(
        `SELECT mi.menu_item_id, mi.category_id, mi.additional_price
         FROM menu_items mi
         JOIN menu_categories mc ON mi.category_id = mc.category_id
         WHERE mi.item_name = ?
           AND mi.availability_status = 'Active'
           AND mc.status = 'Active'
         LIMIT 1`,
        [itemName],
      );

      if (menuItems.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: `Menu item '${itemName}' is no longer available (missing or inactive). Ask the customer to choose a different item and resubmit the request.`,
          },
        });
      }

      await connection.query(
        `INSERT INTO booking_menu_selections (booking_id, category_id, menu_item_id)
         VALUES (?, ?, ?)`,
        [
          request.booking_id,
          menuItems[0].category_id,
          menuItems[0].menu_item_id,
        ],
      );
      additionalPriceSum += parseFloat(menuItems[0].additional_price || 0);
    }

    // Update dietary notes on booking if provided in request
    if (request.dietary_notes) {
      await connection.query(
        "UPDATE bookings SET dietary_notes = ? WHERE booking_id = ?",
        [request.dietary_notes, request.booking_id],
      );
    }

    // Recompute the booking price from the approved selections. The base is the
    // price the customer originally booked at (recovered from the old total),
    // NOT the package's current tier — so a package price change after booking
    // can never skew the surcharge. Menu items add an additional_price on top of
    // that base (same formula as createBooking), so switching to pricier items
    // must raise the total and charge the difference; downgrades lower the total
    // (no refund is issued).
    const round2 = (n) => Math.round(n * 100) / 100;
    const oldTotal = parseFloat(request.total_price);
    let basePrice;
    if (oldSelectionsRows.length > 0) {
      basePrice = round2(oldTotal - oldAdditionalSum);
    } else {
      // Fallback for a booking with no stored menu rows: use the current tier.
      const [pricingRows] = await connection.query(
        "SELECT price FROM package_pricing WHERE package_id = ? AND pax_count = ?",
        [request.package_id, request.number_of_pax],
      );
      if (pricingRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Selected guest count tier is not available for this package.",
          },
        });
      }
      basePrice = parseFloat(pricingRows[0].price);
    }

    const newTotal = round2(basePrice + additionalPriceSum);
    const amountPaid = parseFloat(request.amount_paid || 0);
    const newRemaining = Math.max(round2(newTotal - amountPaid), 0);
    // Bill only the increase the customer has not already covered. If the
    // customer overpaid relative to the old total, part (or all) of the rise is
    // already settled and must not be charged again.
    const priceDelta = round2(newTotal - Math.max(amountPaid, oldTotal));

    // Update the booking's total and remaining balance. A menu change is only
    // allowed on confirmed (fully-paid) bookings, so a price increase becomes
    // the new remaining balance the customer still owes.
    await connection.query(
      `UPDATE bookings
       SET total_price = ?, remaining_balance = ?, updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ?`,
      [newTotal, newRemaining, request.booking_id],
    );

    // If the approved changes cost more, the difference becomes a FinalPayment
    // row. It flows through the normal receipt → admin-verification path
    // (verifyReceipt credits bookings.amount_paid on approval).
    //
    // One row per type rule (option A): if there is still an unsettled original
    // FinalPayment (Pending / Overdue / Rejected — re-uploadable payments),
    // increase its amount instead of inserting a second row. When the original
    // is already Paid — or a settlement is in flight (For_Verification) or was
    // Cancelled — a new row is inserted, since merging into it would either
    // credit a receipt that never covered the delta or resurrect a dead row.
    if (priceDelta > 0.01) {
      const [finalPayments] = await connection.query(
        `SELECT payment_id, payment_status FROM payments
         WHERE booking_id = ? AND payment_type = 'FinalPayment'
         ORDER BY payment_id ASC`,
        [request.booking_id],
      );
      const original = finalPayments[0];
      const MERGEABLE_STATUSES = ["Pending", "Overdue", "Rejected"];
      if (
        original &&
        MERGEABLE_STATUSES.includes(original.payment_status)
      ) {
        await connection.query(
          `UPDATE payments
           SET amount = amount + ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
           WHERE payment_id = ?`,
          [priceDelta, request.event_date, original.payment_id],
        );
      } else {
        await connection.query(
          `INSERT INTO payments (booking_id, payment_type, amount, due_date, payment_status)
           VALUES (?, 'FinalPayment', ?, ?, 'Pending')`,
          [request.booking_id, priceDelta, request.event_date],
        );
      }
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
      userId: request.user_id,
      bookingId: request.booking_id,
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
      userId: request.user_id,
      bookingId: request.booking_id,
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
