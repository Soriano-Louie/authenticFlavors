import { pool } from "../db/pool.js";
import { getPhilippineDateString } from "../utils/timezone.js";
import { createNotification } from "../services/notificationService.js";
import { logActivity } from "../services/activityService.js";
import {
  sendVenueSetupRequestedAdminEmail,
  sendVenueSetupApprovedCustomerEmail,
  sendVenueSetupChangesRequestedCustomerEmail,
  sendVenueSetupDeclinedCustomerEmail,
} from "../services/emailService.js";

function getDaysUntilEvent(eventDateStr) {
  const todayStr = getPhilippineDateString();
  const today = new Date(todayStr);
  const target = new Date(
    typeof eventDateStr === "string"
      ? eventDateStr.split("T")[0]
      : eventDateStr,
  );
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export async function submitVenueSetupRequest(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const bookingId = Number(req.params.id);
    const userId = Number(req.auth.sub);
    const { venue_setup_notes } = req.body;

    if (!venue_setup_notes || !venue_setup_notes.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Venue setup notes are required.",
        },
      });
    }

    await connection.beginTransaction();

    // Lock the booking row for the whole submit so two simultaneous
    // submissions for the same booking can't both slip past the active-request
    // check (race fix). Ownership is enforced by the WHERE below.
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

    // Only active (Reserved or Confirmed) bookings may have venue setup work reviewed;
    // pending, cancelled, rejected, or completed bookings must not.
    if (!["Confirmed", "Reserved"].includes(booking.booking_status)) {
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message:
            "Venue setup requests are only allowed for active bookings (Reserved or Confirmed).",
        },
      });
    }

    // 14-day rule check (mirrors the menu-change guard) so customers cannot
    // submit setup work at the last minute.
    const daysUntilEvent = getDaysUntilEvent(booking.event_date);
    if (daysUntilEvent < 14) {
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "VENUE_SETUP_RESTRICTED",
          message:
            "Venue setup requests are only allowed until 14 days before the scheduled event.",
        },
      });
    }

    // The same endpoint doubles as the resubmit path: when the admin asked for
    // changes, this updates that request and puts it back to Pending instead of
    // rejecting the customer (the "edit & resubmit" flow). A still-Pending request
    // is the only thing that must block a new submission.
    const [existingActive] = await connection.query(
      `SELECT request_id, status FROM venue_setup_requests
       WHERE booking_id = ? AND status IN ('Pending', 'Changes_Requested')
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [bookingId],
    );

    let requestId;
    if (existingActive.length > 0) {
      const existing = existingActive[0];
      if (existing.status === "Pending") {
        await connection.rollback();
        return res.status(400).json({
          error: {
            code: "PENDING_REQUEST_EXISTS",
            message:
              "You already have a pending venue setup request for this booking. Please wait for the admin to respond before submitting again.",
          },
        });
      }
      // Changes_Requested → resubmit: replace the notes, reopen as Pending,
      // and clear the admin review fields so the admin can re-review it.
      await connection.query(
        `UPDATE venue_setup_requests
         SET venue_setup_notes = ?, status = 'Pending',
             admin_response = NULL, reviewed_by = NULL, reviewed_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE request_id = ?`,
        [venue_setup_notes.trim(), existing.request_id],
      );
      requestId = existing.request_id;
    } else {
      const [result] = await connection.query(
        `INSERT INTO venue_setup_requests (booking_id, user_id, venue_setup_notes, status)
         VALUES (?, ?, ?, 'Pending')`,
        [bookingId, userId, venue_setup_notes.trim()],
      );
      requestId = result.insertId;
    }

    await connection.commit();

    logActivity({
      actorUserId: userId,
      actorRole: "Customer",
      activityType: "venue_setup_submitted",
      action: `submitted venue setup notes for Booking #${(booking.booking_reference || `#${bookingId}`).replace(/^#/, "")}`,
      bookingId,
    }).catch((err) =>
      console.error(
        "Activity logging failed (venue_setup_submitted):",
        err,
      ),
    );

    const [admins] = await pool.query(
      "SELECT user_id, email FROM users WHERE role = 'Admin'",
    );

    const customerName = `${booking.first_name} ${booking.last_name}`.trim();
    for (const admin of admins) {
      await createNotification({
        userId: admin.user_id,
        bookingId,
        type: "venue_setup_requested",
        title: "New Venue Setup Request",
        message: `Customer ${customerName} submitted venue setup notes for booking ${booking.booking_reference || `#${bookingId}`}.`,
        link: `/admin`,
      });

      // Notify admins by email too, matching the menu-change flow, so a
      // request is never missed by an admin who doesn't have the dashboard open.
      try {
        await sendVenueSetupRequestedAdminEmail(admin.email, {
          booking_reference: booking.booking_reference || `#${bookingId}`,
          customer_name: customerName,
          event_date: booking.event_date,
          venue_setup_notes: venue_setup_notes.trim(),
        });
      } catch (e) {
        console.error("Failed to send admin venue setup email:", e.message);
      }
    }

    res.status(201).json({
      message: "Venue setup request submitted successfully.",
      request_id: requestId,
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function getBookingVenueSetupRequest(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    const userId = Number(req.auth.sub);
    const userRole = req.auth.role;

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
      `SELECT vsr.*, b.booking_reference, b.event_date, b.booking_status
       FROM venue_setup_requests vsr
       JOIN bookings b ON vsr.booking_id = b.booking_id
       WHERE vsr.booking_id = ?
       ORDER BY vsr.created_at DESC
       LIMIT 1`,
      [bookingId],
    );

    if (requests.length === 0) {
      return res.json({ request: null });
    }

    res.json({ request: requests[0] });
  } catch (error) {
    next(error);
  }
}

export async function getAdminVenueSetupRequests(req, res, next) {
  try {
    const [requests] = await pool.query(
      `SELECT vsr.*, b.booking_reference, b.event_date, b.booking_status,
              p.package_name, u.first_name, u.last_name, u.email
       FROM venue_setup_requests vsr
       JOIN bookings b ON vsr.booking_id = b.booking_id
       JOIN packages p ON b.package_id = p.package_id
       JOIN users u ON vsr.user_id = u.user_id
       ORDER BY vsr.created_at DESC`,
    );

    res.json({ requests });
  } catch (error) {
    next(error);
  }
}

export async function approveVenueSetupRequest(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const requestId = Number(req.params.requestId);
    const adminId = Number(req.auth.sub);

    await connection.beginTransaction();

    const [requests] = await connection.query(
      `SELECT vsr.*, b.booking_reference, b.event_date, u.user_id, u.first_name, u.last_name, u.email
       FROM venue_setup_requests vsr
       JOIN bookings b ON vsr.booking_id = b.booking_id
       JOIN users u ON vsr.user_id = u.user_id
       WHERE vsr.request_id = ? LIMIT 1 FOR UPDATE`,
      [requestId],
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ error: { message: "Venue setup request not found." } });
    }

    const request = requests[0];
    if (request.status !== "Pending" && request.status !== "Changes_Requested") {
      await connection.rollback();
      return res.status(400).json({
        error: { message: `Request is already ${request.status.toLowerCase()}.` },
      });
    }

    await connection.query(
      `UPDATE venue_setup_requests
       SET status = 'Approved', reviewed_by = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [adminId, requestId],
    );

    await connection.query(
      `INSERT INTO booking_history (booking_id, change_type, description, previous_state, new_state, changed_by)
       VALUES (?, 'VENUE_SETUP_APPROVED', ?, ?, ?, ?)`,
      [
        request.booking_id,
        `Venue setup request #${requestId} approved by admin.`,
        JSON.stringify({ status: request.status, notes: request.venue_setup_notes }),
        JSON.stringify({ status: "Approved", admin_response: request.admin_response }),
        adminId,
      ],
    );

    await connection.commit();

    logActivity({
      actorUserId: adminId,
      actorRole: "Admin",
      activityType: "venue_setup_approved",
      action: `approved the venue setup for Booking #${(request.booking_reference || `#${request.booking_id}`).replace(/^#/, "")}`,
      bookingId: request.booking_id,
    }).catch((err) =>
      console.error("Activity logging failed (venue_setup_approved):", err),
    );

    const customerName = `${request.first_name} ${request.last_name}`.trim();
    await createNotification({
      userId: request.user_id,
      bookingId: request.booking_id,
      type: "venue_setup_approved",
      title: "Venue Setup Request Approved",
      message: `Your venue setup request for booking ${request.booking_reference || `#${request.booking_id}`} has been approved!`,
      link: `/dashboard?tab=events&bookingId=${request.booking_id}`,
    });

    try {
      await sendVenueSetupApprovedCustomerEmail(
        request.email,
        request.first_name,
        {
          booking_reference: request.booking_reference || `#${request.booking_id}`,
          event_date: request.event_date,
        },
      );
    } catch (e) {
      console.error("Failed to send venue setup approval email:", e.message);
    }

    res.json({ message: "Venue setup request approved successfully." });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function requestVenueSetupChanges(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const requestId = Number(req.params.requestId);
    const adminId = Number(req.auth.sub);
    const { admin_response } = req.body;

    if (!admin_response || !admin_response.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Admin response is required when requesting changes.",
        },
      });
    }

    await connection.beginTransaction();

    const [requests] = await connection.query(
      `SELECT vsr.*, b.booking_reference, b.event_date, u.user_id, u.first_name, u.last_name, u.email
       FROM venue_setup_requests vsr
       JOIN bookings b ON vsr.booking_id = b.booking_id
       JOIN users u ON vsr.user_id = u.user_id
       WHERE vsr.request_id = ? LIMIT 1 FOR UPDATE`,
      [requestId],
    );

    if (requests.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ error: { message: "Venue setup request not found." } });
    }

    const request = requests[0];
    if (request.status !== "Pending" && request.status !== "Changes_Requested") {
      await connection.rollback();
      return res.status(400).json({
        error: { message: `Request is already ${request.status.toLowerCase()}.` },
      });
    }

    await connection.query(
      `UPDATE venue_setup_requests
       SET status = 'Changes_Requested', admin_response = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [admin_response.trim(), adminId, requestId],
    );

    await connection.query(
      `INSERT INTO booking_history (booking_id, change_type, description, previous_state, new_state, changed_by)
       VALUES (?, 'VENUE_SETUP_CHANGES_REQUESTED', ?, ?, ?, ?)`,
      [
        request.booking_id,
        `Venue setup request #${requestId} changes requested by admin.`,
        JSON.stringify({ status: request.status, notes: request.venue_setup_notes }),
        JSON.stringify({ status: "Changes_Requested", admin_response: admin_response.trim() }),
        adminId,
      ],
    );

    await connection.commit();

    logActivity({
      actorUserId: adminId,
      actorRole: "Admin",
      activityType: "venue_setup_changes_requested",
      action: `requested changes for the venue setup of Booking #${(request.booking_reference || `#${request.booking_id}`).replace(/^#/, "")}`,
      bookingId: request.booking_id,
    }).catch((err) =>
      console.error(
        "Activity logging failed (venue_setup_changes_requested):",
        err,
      ),
    );

    await createNotification({
      userId: request.user_id,
      bookingId: request.booking_id,
      type: "venue_setup_changes_requested",
      title: "Venue Setup Changes Requested",
      message: `The admin requested changes to your venue setup for booking ${request.booking_reference || `#${request.booking_id}`}. Please review and update your request.`,
      link: `/dashboard?tab=events&bookingId=${request.booking_id}`,
    });

    try {
      await sendVenueSetupChangesRequestedCustomerEmail(
        request.email,
        request.first_name,
        {
          booking_reference: request.booking_reference || `#${request.booking_id}`,
          event_date: request.event_date,
        },
        admin_response.trim(),
      );
    } catch (e) {
      console.error("Failed to send venue setup changes requested email:", e.message);
    }

    res.json({ message: "Venue setup changes requested successfully." });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function declineVenueSetupRequest(req, res, next) {
  try {
    const requestId = Number(req.params.requestId);
    const adminId = Number(req.auth.sub);
    const { admin_response } = req.body;

    if (!admin_response || !admin_response.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Admin response is required when declining a request.",
        },
      });
    }

    const [requests] = await pool.query(
      `SELECT vsr.*, b.booking_reference, b.event_date, u.user_id, u.first_name, u.last_name, u.email
       FROM venue_setup_requests vsr
       JOIN bookings b ON vsr.booking_id = b.booking_id
       JOIN users u ON vsr.user_id = u.user_id
       WHERE vsr.request_id = ? LIMIT 1`,
      [requestId],
    );

    if (requests.length === 0) {
      return res
        .status(404)
        .json({ error: { message: "Venue setup request not found." } });
    }

    const request = requests[0];
    if (request.status !== "Pending" && request.status !== "Changes_Requested") {
      return res.status(400).json({
        error: { message: `Request is already ${request.status.toLowerCase()}.` },
      });
    }

    await pool.query(
      `UPDATE venue_setup_requests
       SET status = 'Declined', admin_response = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [admin_response.trim(), adminId, requestId],
    );

    await pool.query(
      `INSERT INTO booking_history (booking_id, change_type, description, previous_state, new_state, changed_by)
       VALUES (?, 'VENUE_SETUP_DECLINED', ?, ?, ?, ?)`,
      [
        request.booking_id,
        `Venue setup request #${requestId} declined by admin.`,
        JSON.stringify({ status: request.status, notes: request.venue_setup_notes }),
        JSON.stringify({ status: "Declined", admin_response: admin_response.trim() }),
        adminId,
      ],
    );

    logActivity({
      actorUserId: adminId,
      actorRole: "Admin",
      activityType: "venue_setup_declined",
      action: `declined the venue setup for Booking #${(request.booking_reference || `#${request.booking_id}`).replace(/^#/, "")}`,
      bookingId: request.booking_id,
    }).catch((err) =>
      console.error("Activity logging failed (venue_setup_declined):", err),
    );

    await createNotification({
      userId: request.user_id,
      bookingId: request.booking_id,
      type: "venue_setup_declined",
      title: "Venue Setup Request Declined",
      message: `Your venue setup request for booking ${request.booking_reference || `#${request.booking_id}`} was declined. Reason: ${admin_response.trim()}`,
      link: `/dashboard?tab=events&bookingId=${request.booking_id}`,
    });

    try {
      await sendVenueSetupDeclinedCustomerEmail(
        request.email,
        request.first_name,
        {
          booking_reference: request.booking_reference || `#${request.booking_id}`,
          event_date: request.event_date,
        },
        admin_response.trim(),
      );
    } catch (e) {
      console.error("Failed to send venue setup declined email:", e.message);
    }

    res.json({ message: "Venue setup request declined successfully." });
  } catch (error) {
    next(error);
  }
}
