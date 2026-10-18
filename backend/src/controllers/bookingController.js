import { queueNotificationEmail } from "../services/emailService.js";
import { assertBookingInput, isCalendarDate } from "../utils/inputValidation.js";
import { resolveMenu } from "../services/bookingRulesService.js";
import { lockBookingCalendar, expireUnpaidHolds } from "../services/reservationHoldService.js";
import { generateUniqueBookingReference } from "../utils/bookingReference.js";
import { applyBookingPaymentTotals } from "../services/bookingPaymentTotalsService.js";
import { pool } from "../db/pool.js";
import {
  getMinimumEventDate,
  getBookingCompletionCutoff,
  getPhilippineDateString,
  toPhilippineDateString,
} from "../utils/timezone.js";
import {
  OPERATING_HOURS,
  isOperatingDay,
  isWithinOperatingHours,
  getOperatingHoursMessage,
} from "../utils/operatingHours.js";
import { createNotification } from "../services/notificationService.js";
import { logActivity } from "../services/activityService.js";
import {
  sendBookingSubmittedEmail,
  sendBookingConfirmedEmail,
  sendBookingRejectedEmail,
  sendBookingCancelledEmail,
  sendAdminEventDayCancelledEmail,
  sendBookingRescheduledEmail,
  sendNewBookingAdminEmail,
} from "../services/emailService.js";
import {
  ACTIVE_BOOKING_STATUSES,
  getDateOccupancy,
  isDateUnavailable,
  isDateUnavailableForUpdate,
} from "../services/availabilityService.js";
import {
  getActiveDiscount,
  applyDiscount,
  discountAmount,
} from "../services/promotionService.js";
import {
  getEventsHostedCount,
  getAverageRating,
} from "../services/statisticsService.js";
import { autoUpdateOverduePayments } from "./paymentController.js";

// Booking lead-time window (in Philippine days) required before an event.
const MIN_EVENT_LEAD_DAYS = 14;

// Create Booking inside transaction
export async function createBooking(req, res) {
  let connection;
  try {
    assertBookingInput(req.body);
    await expireUnpaidHolds();
    connection = await pool.getConnection();
    const userId = Number(req.auth.sub);

    // Admin accounts manage bookings; they cannot create bookings (manual or
    // via the chatbot wizard, which both submit through this endpoint).
    if (req.auth.role !== "Customer") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Admin accounts cannot create bookings.",
        },
      });
    }

    const {
      package_id,
      event_type_name,
      venue_setup_name,
      venue_setup_names, // Selected setups array
      number_of_pax,
      contact_name,
      contact_email,
      contact_phone,
      event_date,
      start_time,
      allergy_notes,
      dietary_notes,
      menu_selections, // String array of selected item names
      total_price, // Frontend submitted price
      is_ai_booking,
      custom_event_type,
    } = req.body;

    // 1. Basic validation
    if (
      !package_id ||
      !event_type_name ||
      !number_of_pax ||
      !contact_name ||
      !contact_email ||
      !event_date ||
      !start_time
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required booking details.",
        },
      });
    }

    if (!Array.isArray(menu_selections) || menu_selections.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Menu selections are required.",
        },
      });
    }

    // 2. Validate event date is not in the past
    const todayStr = getPhilippineDateString();
    if (event_date < todayStr) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Event date cannot be in the past.",
        },
      });
    }

    // 2a. Validate event date is at least 14 days (two weeks) from today,
    // computed entirely in Philippine time — the same value served by the
    // booking-config endpoint the frontend uses, so the two can never drift.
    const minLeadTimeStr = getMinimumEventDate(MIN_EVENT_LEAD_DAYS);
    if (event_date < minLeadTimeStr) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Event booking must be scheduled at least 14 days (two weeks) in advance to allow time for the down payment.",
        },
      });
    }

    // 2b. Store is closed on Mondays (open Tue-Sun, 11am-10pm)
    const [year, month, day] = event_date.split("-").map(Number);
    const eventDay = new Date(year, month - 1, day).getDay();
    if (eventDay === 1) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "The store is closed on Mondays. Please choose another date.",
        },
      });
    }

    // 2c. Reject dates that are already unavailable for any reason: occupied by
    // active bookings (single shared rule for manual and chatbot bookings) or
    // blocked by an admin (e.g. a rest day). Cancelled bookings never block it.
    // This pre-check is a best-effort fast path; the authoritative, race-proof
    // check runs inside the transaction below.
    if (await isDateUnavailable(connection, event_date)) {
      return res.status(409).json({
        error: {
          code: "DATE_UNAVAILABLE",
          message:
            "The selected date is no longer available. Please choose another date.",
        },
      });
    }

    // Start database transaction
    await connection.beginTransaction();
    await lockBookingCalendar(connection);
    const [pendingHolds] = await connection.query("SELECT booking_id FROM bookings WHERE user_id = ? AND booking_status = 'Pending' LIMIT 3", [userId]);
    if (pendingHolds.length >= 3) {
      await connection.rollback();
      return res.status(429).json({ error: { code: "BOOKING_LIMIT", message: "Please settle or cancel an existing pending booking before creating another." } });
    }

    // 2c-2. Authoritative availability check inside the transaction. It takes a
    // locking read (FOR UPDATE) on the event_date index, so two concurrent
    // bookings for the same date serialize: the losing request waits, then sees
    // the just-inserted booking and is rejected — making the one-booking-per-day
    // rule atomic even under concurrency.
    if (await isDateUnavailableForUpdate(connection, event_date)) {
      await connection?.rollback();
      return res.status(409).json({
        error: {
          code: "DATE_UNAVAILABLE",
          message:
            "The selected date is no longer available. Please choose another date.",
        },
      });
    }

    // 3. Resolve event_type_id
    const [eventTypes] = await connection.query(
      "SELECT event_type_id FROM event_types WHERE type_name = ? AND status = 'Active'",
      [event_type_name],
    );
    if (eventTypes.length === 0) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid or inactive event type.",
        },
      });
    }
    const event_type_id = eventTypes[0].event_type_id;

    // 3a. Validate custom_event_type when "Other" is selected
    if (event_type_name === "Other") {
      const customType = (custom_event_type || "").trim();
      if (!customType) {
        await connection?.rollback();
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Please specify the event type since you selected 'Other'.",
          },
        });
      }
    }

    // 3b. Validate booking start time against operating hours
    if (!isOperatingDay(event_date)) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "The store is closed on Mondays. Please choose another date.",
        },
      });
    }

    if (!isWithinOperatingHours(start_time)) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: getOperatingHoursMessage(),
        },
      });
    }

    // 4. Resolve venue_setup_id
    const primarySetupName =
      venue_setup_name ||
      (Array.isArray(venue_setup_names) && venue_setup_names[0]) ||
      "Standard Setup";
    const [venueSetups] = await connection.query(
      "SELECT venue_setup_id FROM venue_setups WHERE setup_name = ? AND status = 'Active'",
      [primarySetupName],
    );
    if (venueSetups.length === 0) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid or inactive venue setup.",
        },
      });
    }
    const venue_setup_id = venueSetups[0].venue_setup_id;

    // 5. Retrieve base price from DB and enforce capacity limits. The package
    // has a hard max_pax and the venue seats at most 70; both are checked here
    // so an oversized booking never reaches the pricing / payments stage.
    const [pricingRows] = await connection.query(
      `SELECT pp.price, pkg.max_pax
       FROM package_pricing pp
       JOIN packages pkg ON pkg.package_id = pp.package_id
       WHERE pp.package_id = ? AND pp.pax_count = ? AND pkg.status = 'Active' FOR UPDATE`,
      [package_id, number_of_pax],
    );
    if (pricingRows.length === 0) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Selected guest count tier is not available for this package.",
        },
      });
    }

    const MAX_VENUE_PAX = 70;
    const packageMaxPax = pricingRows[0].max_pax;
    if (packageMaxPax != null && number_of_pax > packageMaxPax) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `This package supports up to ${packageMaxPax} guests.`,
        },
      });
    }
    if (number_of_pax > MAX_VENUE_PAX) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `The venue can accommodate up to ${MAX_VENUE_PAX} guests.`,
        },
      });
    }

    const basePrice = parseFloat(pricingRows[0].price);

    const resolvedMenuSelections = await resolveMenu(connection, package_id, menu_selections);
    const additionalPriceSum = resolvedMenuSelections.reduce((sum, item) => sum + Number(item.additional_price || 0), 0);

    // 7. Apply any live promotion and verify price matching. The pre-discount
    // total is always recomputed from the DB and the client value is never
    // trusted for pricing; the active announcement discount is also resolved
    // server-side (never read from the body), so the client cannot fake one.
    // When the client supplies a total_price it must match the discounted
    // total, so the check cannot be bypassed with falsy/empty input.
    const calculatedTotal = basePrice + additionalPriceSum;
    const activeDiscount = await getActiveDiscount(
      package_id,
      number_of_pax,
      connection,
    );
    const discountedTotal = applyDiscount(calculatedTotal, activeDiscount);
    const discountApplied = discountAmount(calculatedTotal, activeDiscount);

    const hasSubmittedPrice =
      req.body.total_price !== undefined &&
      req.body.total_price !== null &&
      req.body.total_price !== "";
    if (
      hasSubmittedPrice &&
      (!Number.isFinite(Number(req.body.total_price)) || Math.abs(discountedTotal - Number(req.body.total_price)) > 0.01)
    ) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Pricing mismatch. Pricing has been recalculated. Please resubmit.",
        },
      });
    }

    // Generate unique 6-digit refs (crypto-random with uniqueness retry).
    // References are UNIQUE at the DB level; if a concurrent booking wins the
    // race for the same reference the INSERT throws ER_DUP_ENTRY, so we
    // regenerate both candidate references and retry (max 3 attempts).
    let booking_reference = await generateUniqueBookingReference(connection);
    // Retain the AI marker for source reporting and older API consumers.
    let ai_booking_reference = is_ai_booking ? booking_reference.slice(3) : null;

    // Setup booking summary JSON
    const summaryData = JSON.stringify({
      venue_options: venue_setup_names || [primarySetupName],
      menu_choices_names: menu_selections,
      original_pax: number_of_pax,
      pricing_snapshot: {
        base_price: basePrice,
        discount: activeDiscount ? { type: activeDiscount.type, value: activeDiscount.value } : null,
        items: Object.fromEntries(resolvedMenuSelections.map(item => [item.menu_item_id, Number(item.additional_price || 0)])),
      },
    });

    // 8. Insert booking (with collision retry on the unique reference columns)
    const bookingParams = () => [
      userId,
      package_id,
      event_type_id,
      event_type_name === "Other" ? custom_event_type?.trim() : null,
      venue_setup_id,
      number_of_pax,
      contact_name,
      contact_email,
      contact_phone || null,
      event_date,
      start_time,
      allergy_notes || null,
      dietary_notes || null,
      summaryData,
      discountedTotal,
      ai_booking_reference,
      booking_reference,
      discountedTotal,
      activeDiscount?.announcement_id ?? null,
      discountApplied,
      calculatedTotal,
    ];
    let bookingResult;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        [bookingResult] = await connection.query(
          `INSERT INTO bookings (
            user_id, package_id, event_type_id, custom_event_type, venue_setup_id, number_of_pax,
            contact_name, contact_email, contact_phone, event_date, start_time,
            allergy_notes, dietary_notes, booking_status, booking_summary, total_price,
            ai_booking_reference, booking_reference, amount_paid, remaining_balance,
            discount_announcement_id, discount_amount, original_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, 0.00, ?, ?, ?, ?)`,
          bookingParams(),
        );
        break;
      } catch (err) {
        if (err?.code !== "ER_DUP_ENTRY" || attempt === 2) throw err;
        booking_reference = await generateUniqueBookingReference(connection);
        ai_booking_reference = is_ai_booking ? booking_reference.slice(3) : null;
      }
    }

    const booking_id = bookingResult.insertId;
    await connection.query("UPDATE bookings SET reservation_expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE booking_id = ?", [booking_id]);

    const [holdRows] = await connection.query(
      "SELECT DATE_FORMAT(reservation_expires_at, '%M %e, %Y at %h:%i %p') AS reservation_deadline FROM bookings WHERE booking_id = ?",
      [booking_id],
    );

    // 9. Insert menu selections
    for (const item of resolvedMenuSelections) {
      await connection.query(
        `INSERT INTO booking_menu_selections (booking_id, category_id, menu_item_id)
         VALUES (?, ?, ?)`,
        [booking_id, item.category_id, item.menu_item_id],
      );
    }

    // 9.5 Auto-create venue setup request if dietary_notes (venue setup notes) provided
    if (dietary_notes && dietary_notes.trim()) {
      await connection.query(
        `INSERT INTO venue_setup_requests (booking_id, user_id, venue_setup_notes, status)
         VALUES (?, ?, ?, 'Pending')`,
        [booking_id, userId, dietary_notes.trim()],
      );
    }

    // 10. Automatically create THREE payment records. The reservation fee is
    // due immediately (computed in Philippine time so it is never a day off),
    // the down payment 14 days before the event, and the final payment on the
    // event date. Installment values are clamped so a cheap package can never
    // produce negative payment amounts.
    const reservationDueDate = getPhilippineDateString();

    const eventDateObj = new Date(event_date);
    const downPaymentDateObj = new Date(eventDateObj);
    downPaymentDateObj.setDate(eventDateObj.getDate() - 14);
    const downPaymentDueDate = downPaymentDateObj.toISOString().split("T")[0];

    const reservationFee = 5000.0;
    // The reservation fee never exceeds the discounted total (a heavy discount
    // or cheap package can't produce a reservation larger than the booking).
    const reservationVal = Math.min(reservationFee, discountedTotal);
    const remainingVal = Math.max(discountedTotal - reservationVal, 0);
    const downPaymentVal = Math.round(Math.max(0, remainingVal * 0.5) * 100) / 100;
    const finalPaymentVal = Math.round(Math.max(0, remainingVal - downPaymentVal) * 100) / 100;

    // Insert Reservation
    await connection.query(
      `INSERT INTO payments (booking_id, payment_type, amount, due_date, payment_status)
       VALUES (?, 'Reservation', ?, ?, 'Pending')`,
      [booking_id, reservationVal, reservationDueDate],
    );

    // Insert Down Payment
    await connection.query(
      `INSERT INTO payments (booking_id, payment_type, amount, due_date, payment_status)
       VALUES (?, 'DownPayment', ?, ?, 'Pending')`,
      [booking_id, downPaymentVal, downPaymentDueDate],
    );

    // Insert Final Payment
    await connection.query(
      `INSERT INTO payments (booking_id, payment_type, amount, due_date, payment_status)
       VALUES (?, 'FinalPayment', ?, ?, 'Pending')`,
      [booking_id, finalPaymentVal, event_date],
    );

    await connection.query("UPDATE payments SET payment_status = 'Paid', paid_at = NOW() WHERE booking_id = ? AND amount = 0", [booking_id]);
    if (discountedTotal === 0) await connection.query("UPDATE bookings SET booking_status = 'Confirmed' WHERE booking_id = ?", [booking_id]);

    const [admins] = await connection.query(
      "SELECT user_id, email FROM users WHERE role = 'Admin'",
    );

    // Trigger notification and Brevo email
    const refStr =
      booking_reference ||
      (ai_booking_reference
        ? `#AF-${ai_booking_reference}`
        : `#BK${String(booking_id).padStart(4, "0")}`);
    await logActivity({
      actorUserId: userId,
      actorRole: "Customer",
      activityType: "booking_submitted",
      action: `submitted Booking #${refStr.replace("#", "")}`,
      bookingId: booking_id,
    }, connection);
    await createNotification({
      userId,
      bookingId: booking_id,
      type: "booking_submitted",
      title: "Booking Request Submitted",
      message: `Your booking request (${refStr}) has been successfully submitted and is under review.`,
      link: `/dashboard?tab=events&bookingId=${booking_id}`,
      sendEmailFn: () =>
        sendBookingSubmittedEmail(contact_email, contact_name, {
          booking_reference: refStr,
          event_date,
          reservation_amount: reservationVal,
          reservation_deadline: holdRows[0]?.reservation_deadline,
          guest_count: number_of_pax,
        }),
    }, connection);

    // Notify all admins via in-app notification & email

    if (admins.length > 0) {
      for (const admin of admins) {
        await createNotification({
          userId: admin.user_id,
          bookingId: booking_id,
          type: "booking_submitted",
          title: "New Booking Received",
          message: `${contact_name} submitted booking ${refStr} (${event_date}, ${number_of_pax} guests) — awaiting review.`,
          link: `/admin`,
          sendEmailFn: () =>
            sendNewBookingAdminEmail(admin.email, {
              booking_reference: refStr,
              customer_name: contact_name,
              event_date,
              guest_count: number_of_pax,
              total_price: discountedTotal,
            }),
        }, connection);
      }
    }

    await connection.commit();

    res.status(201).json({
      message: "Booking submitted successfully.",
      booking_id,
      total_price: discountedTotal,
      ...(activeDiscount
        ? {
            discount_amount: discountApplied,
            original_total: calculatedTotal,
          }
        : {}),
      ...(ai_booking_reference ? { ai_booking_reference } : {}),
      ...(booking_reference ? { booking_reference } : {}),
    });
  } catch (error) {
    await connection?.rollback();
    if (error.status && error.status < 500) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error("Booking transaction failed:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to create booking." },
    });
  } finally {
    connection?.release();
  }
}

// Auto-complete past confirmed/reserved/pending-with-receipt bookings
// Complete at 11:59 PM Philippine time, including missed runs after restart.
export async function autoCompletePastBookings() {
  await pool.query(`UPDATE bookings SET booking_status = 'Completed', updated_at = CURRENT_TIMESTAMP
    WHERE event_date < ? AND booking_status IN ('Reserved', 'Confirmed')`, [getBookingCompletionCutoff()]);
}

// Auto-cancel bookings that never paid the reservation (so no down payment was
// ever released) and whose event date has already passed. This prevents stale
// "Pending" bookings from lingering indefinitely after the event can no longer
// happen.
//
// Only bookings WITHOUT a settled or under-review reservation are eligible: a
// receipt uploaded but not yet verified (For_Verification) must never be
// destroyed by this sweep. The whole check-and-cancel runs in one transaction
// with FOR UPDATE locks so a booking verified concurrently (Pending ->
// Reserved) is never half-cancelled.
export async function autoCancelUnpaidPastBookings() {
  const todayStr = getPhilippineDateString();

  // Skip the query entirely when nothing is due.
  const [due] = await pool.query(
    `SELECT b.booking_id FROM bookings b
     WHERE b.booking_status = 'Pending'
       AND b.event_date < ?
       AND NOT EXISTS (
         SELECT 1 FROM payments p
         WHERE p.booking_id = b.booking_id
           AND p.payment_type = 'Reservation'
           AND p.payment_status IN ('Paid', 'For_Verification')
       )
     LIMIT 1`,
    [todayStr],
  );
  if (due.length === 0) return;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT b.booking_id, b.user_id, b.booking_reference, b.ai_booking_reference,
              u.email, u.first_name, u.last_name
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       WHERE b.booking_status = 'Pending'
         AND b.event_date < ?
         AND NOT EXISTS (
           SELECT 1 FROM payments p
           WHERE p.booking_id = b.booking_id
             AND p.payment_type = 'Reservation'
             AND p.payment_status IN ('Paid', 'For_Verification')
         )
       FOR UPDATE`,
      [todayStr],
    );

    if (rows.length === 0) {
      await connection?.rollback();
      return;
    }

    const ids = rows.map((b) => b.booking_id);
    const placeholders = ids.map(() => "?").join(",");

    // Cancel only the unpaid installments of still-pending bookings. The JOIN
    // re-checks booking_status so a concurrently-verified booking is never
    // touched, and reservations under admin review (For_Verification) are
    // preserved.
    await connection.query(
      `UPDATE payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       SET p.payment_status = 'Cancelled', p.updated_at = CURRENT_TIMESTAMP
       WHERE b.booking_id IN (${placeholders})
         AND b.booking_status = 'Pending'
         AND p.payment_status IN ('Pending', 'Overdue')
         AND p.payment_type != 'CancellationCharge'`,
      ids,
    );

    const [cancelResult] = await connection.query(
      `UPDATE bookings
       SET booking_status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE booking_id IN (${placeholders}) AND booking_status = 'Pending'`,
      ids,
    );
    if (cancelResult.affectedRows === 0) {
      await connection?.rollback();
      return;
    }

    for (const b of rows) {
      const refStr =
        b.booking_reference ||
        (b.ai_booking_reference ? `#AF-${b.ai_booking_reference}` : `#BK${String(b.booking_id).padStart(4, "0")}`);
      const reason =
        "Your booking was automatically cancelled because the reservation / down payment was not received before the event date.";

      await logActivity({
        actorUserId: null,
        actorRole: "System",
        activityType: "booking_cancelled_system",
        action: `automatically cancelled Booking #${refStr.replace(/^#/, "")} - reservation / down payment not received before the event date`,
        bookingId: b.booking_id,
      }, connection);

      await createNotification({
        userId: b.user_id,
        bookingId: b.booking_id,
        type: "booking_cancelled_unpaid",
        title: "Booking Cancelled",
        message: `Your booking (${refStr}) has been cancelled because the reservation / down payment was not received before the event date.`,
        link: `/dashboard?tab=events&bookingId=${b.booking_id}`,
        sendEmailFn: () =>
          sendBookingCancelledEmail(
            b.email,
            b.first_name,
            { booking_reference: refStr },
            reason,
          ),
      }, connection);
    }
    await connection.commit();
  } catch (error) {
    await connection?.rollback();
    if (error.status && error.status < 500) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error("Auto-cancel unpaid bookings sweep failed:", error);
  } finally {
    connection?.release();
  }
}

// Single public source of truth for date availability (used by the manual
// booking calendar, the chatbot, and the homepage calendar alike).
export async function getDateAvailability(_req, res) {
  try {
    const availability = await getDateOccupancy();
    res.status(200).json(availability);
  } catch (error) {
    console.error("Error fetching date availability:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch availability.",
      },
    });
  }
}

// Booking rules shared with the frontend. The 14-day lead-time cutoff is
// computed ONCE here, in Philippine time, and the frontend uses the returned
// min_event_date for its calendar — the browser's local clock is never allowed
// to decide the cutoff (fixes the backend/frontend boundary disagreement).
export async function getBookingConfig(_req, res) {
  try {
    res.status(200).json({
      min_event_date: getMinimumEventDate(MIN_EVENT_LEAD_DAYS),
      min_lead_days: MIN_EVENT_LEAD_DAYS,
      today: getPhilippineDateString(),
      operating_hours: OPERATING_HOURS,
    });
  } catch (error) {
    console.error("Error fetching booking config:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch booking config.",
      },
    });
  }
}

// Fetch all bookings for authenticated customer
export async function getBookings(req, res) {
  try {
    const userId = Number(req.auth.sub);

    // Auto-complete past confirmed bookings before fetching
    await autoCompletePastBookings();

    // Auto-cancel past pending bookings that never paid the reservation
    await autoCancelUnpaidPastBookings();

    const [bookings] = await pool.query(
      `SELECT b.*, p.package_name, et.type_name, vs.setup_name,
              DATEDIFF(b.event_date, ?) AS days_until_event
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN event_types et ON b.event_type_id = et.event_type_id
       JOIN venue_setups vs ON b.venue_setup_id = vs.venue_setup_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [getPhilippineDateString(), userId],
    );

    // Fetch menu selections for all bookings in one query (avoids N+1)
    const menuByBooking = new Map();
    if (bookings.length > 0) {
      const ids = bookings.map((b) => b.booking_id);
      const placeholders = ids.map(() => "?").join(",");
      const [menuSelections] = await pool.query(
        `SELECT bms.booking_id, mi.item_name, mc.category_name
         FROM booking_menu_selections bms
         JOIN menu_items mi ON bms.menu_item_id = mi.menu_item_id
         JOIN menu_categories mc ON bms.category_id = mc.category_id
         WHERE bms.booking_id IN (${placeholders})`,
        ids,
      );
      for (const row of menuSelections) {
        const list = menuByBooking.get(row.booking_id);
        const entry = { item_name: row.item_name, category_name: row.category_name };
        if (list) list.push(entry);
        else menuByBooking.set(row.booking_id, [entry]);
      }
    }

    await applyBookingPaymentTotals(bookings);

    const bookingsWithDetails = bookings.map((booking) => {
      const refundInfo =
        booking.booking_status === "Cancelled"
          ? calculateCancellationRefund(
              booking.total_price,
              booking.amount_paid,
              booking.cancellation_policy_applied,
            )
          : null;
      return {
        ...booking,
        refundable_amount: refundInfo ? refundInfo.refundable_amount : 0,
        menu_selections: menuByBooking.get(booking.booking_id) ?? [],
      };
    });

    res.status(200).json({ bookings: bookingsWithDetails });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch bookings." },
    });
  }
}

// Booking statuses actually produced by the system (createBooking, verifyBooking,
// completeBooking, rejectBooking, requestCancellation). "Overdue" is handled as a
// derived filter because it is a payment-level state, not a stored booking status.
const ADMIN_BOOKING_STATUSES = [
  "Pending",
  "Reserved",
  "Confirmed",
  "Completed",
  "Cancelled",
  "Rejected",
];

// Fetch all bookings for admin, optionally filtered by status and search query.
// Supports GET /api/admin/bookings?status=Completed&search=Juan
export async function getAdminBookings(req, res) {
  try {
    // Auto-complete past confirmed bookings before fetching
    await autoCompletePastBookings();

    // Auto-cancel past pending bookings that never paid the reservation
    await autoCancelUnpaidPastBookings();

    const { status, search } = req.query;

    // Pagination: cap the page size so large datasets stay responsive.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 1000);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    const whereClauses = [];
    const params = [];

    if (status && status !== "All") {
      if (status === "Overdue") {
        // Derived from unsettled payments whose due date has passed.
        // Completed, cancelled, and rejected bookings are never overdue.
        // The due-date cutoff uses the Philippine calendar day, not CURDATE().
        whereClauses.push(`
          b.booking_status NOT IN ('Cancelled', 'Rejected', 'Completed')
          AND EXISTS (
            SELECT 1 FROM payments p
            WHERE p.booking_id = b.booking_id
              AND p.payment_status IN ('Pending', 'Overdue')
              AND p.payment_type != 'CancellationCharge'
              AND p.due_date < ?
          )
        `);
        params.push(getPhilippineDateString());
      } else if (ADMIN_BOOKING_STATUSES.includes(status)) {
        whereClauses.push("b.booking_status = ?");
        params.push(status);
      } else {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid booking status filter: ${status}`,
          },
        });
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const like = `%${q}%`;
      const searchFields = [
        "b.booking_reference LIKE ?",
        "CAST(b.ai_booking_reference AS CHAR) LIKE ?",
        "u.first_name LIKE ?",
        "u.last_name LIKE ?",
        "b.contact_name LIKE ?",
        "b.contact_email LIKE ?",
        "p.package_name LIKE ?",
        "et.type_name LIKE ?",
        "b.booking_status LIKE ?",
        "CAST(b.booking_id AS CHAR) LIKE ?",
      ];
      whereClauses.push(`(${searchFields.join(" OR ")})`);
      searchFields.forEach(() => params.push(like));
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [[totalRows]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN event_types et ON b.event_type_id = et.event_type_id
       JOIN venue_setups vs ON b.venue_setup_id = vs.venue_setup_id
       JOIN users u ON b.user_id = u.user_id
       ${whereSql}`,
      params,
    );
    const total = totalRows?.total ?? 0;

    const [bookings] = await pool.query(
      `SELECT b.*, p.package_name, et.type_name, vs.setup_name,
              u.first_name, u.middle_name, u.last_name
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN event_types et ON b.event_type_id = et.event_type_id
       JOIN venue_setups vs ON b.venue_setup_id = vs.venue_setup_id
       JOIN users u ON b.user_id = u.user_id
       ${whereSql}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    // Fetch menu selections for all bookings in one query (avoids N+1)
    const menuByBooking = new Map();
    if (bookings.length > 0) {
      const ids = bookings.map((b) => b.booking_id);
      const placeholders = ids.map(() => "?").join(",");
      const [menuSelections] = await pool.query(
        `SELECT bms.booking_id, mi.item_name, mc.category_name
         FROM booking_menu_selections bms
         JOIN menu_items mi ON bms.menu_item_id = mi.menu_item_id
         JOIN menu_categories mc ON bms.category_id = mc.category_id
         WHERE bms.booking_id IN (${placeholders})`,
        ids,
      );
      for (const row of menuSelections) {
        const list = menuByBooking.get(row.booking_id);
        const entry = { item_name: row.item_name, category_name: row.category_name };
        if (list) list.push(entry);
        else menuByBooking.set(row.booking_id, [entry]);
      }
    }

    await applyBookingPaymentTotals(bookings);

    const bookingsWithDetails = bookings.map((booking) => {
      const refundInfo =
        booking.booking_status === "Cancelled"
          ? calculateCancellationRefund(
              booking.total_price,
              booking.amount_paid,
              booking.cancellation_policy_applied,
            )
          : null;
      return {
        ...booking,
        refundable_amount: refundInfo ? refundInfo.refundable_amount : 0,
        menu_selections: menuByBooking.get(booking.booking_id) ?? [],
      };
    });

    res.status(200).json({ bookings: bookingsWithDetails, total, page, limit });
  } catch (error) {
    console.error("Error fetching admin bookings:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch admin bookings.",
      },
    });
  }
}

// Manually complete booking (Admin only)
export async function completeBooking(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const bookingId = Number(req.params.id);

    // Lock the row so only one request can complete the booking.
    await connection.beginTransaction();

    const [bookings] = await connection.query(
      "SELECT event_date, booking_status, booking_reference, ai_booking_reference FROM bookings WHERE booking_id = ? LIMIT 1 FOR UPDATE",
      [bookingId],
    );

    if (bookings.length === 0) {
      await connection?.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    // Check if event date has finished (Philippine time)
    const todayStr = getPhilippineDateString();
    const eventDateStr = toPhilippineDateString(booking.event_date);

    if (eventDateStr > todayStr) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Cannot complete an event that has not finished yet.",
        },
      });
    }

    if (
      booking.booking_status !== "Confirmed" &&
      booking.booking_status !== "Reserved"
    ) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Only reserved or confirmed bookings can be marked as completed.",
        },
      });
    }

    // Manual completion requires a verified payment stage, not merely an uploaded receipt.
    const [paidDeposits] = await connection.query(
      `SELECT payment_id FROM payments
       WHERE booking_id = ?
         AND payment_type IN ('Reservation', 'DownPayment')
         AND payment_status = 'Paid'
       LIMIT 1`,
      [bookingId],
    );

    if (paidDeposits.length === 0) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "PAYMENT_REQUIRED",
          message:
            "Cannot mark booking as completed: No reservation fee or down payment has been verified.",
        },
      });
    }

    const [updateResult] = await connection.query(
      "UPDATE bookings SET booking_status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE booking_id = ? AND booking_status IN ('Confirmed', 'Reserved')",
      [bookingId],
    );

    if (updateResult.affectedRows === 0) {
      await connection?.rollback();
      return res.status(409).json({
        error: {
          code: "INVALID_STATE",
          message: "Booking has already been processed by another request.",
        },
      });
    }

    await connection.commit();

    logActivity({
      actorUserId: Number(req.auth?.sub) || null,
      actorRole: "Admin",
      activityType: "booking_completed",
      action: `completed Booking #${booking.booking_reference || (booking.ai_booking_reference ? `#AF-${booking.ai_booking_reference}` : `#BK${String(bookingId).padStart(4, "0")}`)}`,
      bookingId,
    }).catch((err) =>
      console.error("Activity logging failed (booking_completed):", err),
    );

    res.status(200).json({
      message: "Booking marked as completed successfully.",
      booking_status: "Completed",
    });
  } catch (error) {
    await connection?.rollback();
    if (error.status && error.status < 500) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error("Complete booking failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to mark booking as completed.",
      },
    });
  } finally {
    connection?.release();
  }
}

// Admin verify booking (Pending -> Confirmed)
export async function verifyBooking(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const bookingId = Number(req.params.id);
    const { admin_remarks } = req.body;

    // Lock the booking row for the whole check-and-update to prevent
    // concurrent verifications from computing stale balances.
    await connection.beginTransaction();

    const [bookings] = await connection.query(
      `SELECT b.booking_id, b.user_id, b.booking_status, b.amount_paid, b.remaining_balance, b.total_price,
              b.booking_reference, b.ai_booking_reference, b.event_date, u.email, u.first_name, p.package_name
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       LEFT JOIN packages p ON b.package_id = p.package_id
       WHERE b.booking_id = ? LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );

    if (bookings.length === 0) {
      await connection?.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    if (booking.booking_status !== "Pending") {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: `Only pending bookings can be verified. Current status: ${booking.booking_status}`,
        },
      });
    }

    // Only one booking per day is allowed, and the date must not be blocked
    // by an admin. Another booking (pending or active) occupying this date must
    // be resolved (cancelled / rejected) first.
    if (await isDateUnavailable(connection, booking.event_date, bookingId)) {
      await connection?.rollback();
      return res.status(409).json({
        error: {
          code: "DATE_UNAVAILABLE",
          message:
            "This date is unavailable (already booked or blocked by the admin). Only one booking per day is allowed.",
        },
      });
    }

    // A booking must not be promoted to Reserved/Confirmed before the
    // reservation fee has been verified as paid.
    // Receiving ₱0 and marking the booking reserved would be a false
    // confirmation and could hand the date to a non-paying customer.
    const [reservationRows] = await connection.query(
      `SELECT payment_status FROM payments
       WHERE booking_id = ? AND payment_type = 'Reservation'
       ORDER BY payment_id DESC LIMIT 1`,
      [bookingId],
    );
    const reservationStatus = reservationRows[0]?.payment_status;
    if (!["Paid"].includes(reservationStatus)) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "RESERVATION_NOT_PAID",
          message:
            "This booking cannot be verified until the reservation fee has been paid.",
        },
      });
    }

    const amountPaid = parseFloat(booking.amount_paid || 0);
    const remainingBalance = parseFloat(
      booking.remaining_balance ?? booking.total_price,
    );
    const newRemainingBalance = Math.max(remainingBalance, 0);
    const newBookingStatus =
      newRemainingBalance <= 0 ? "Confirmed" : "Reserved";

    const [updateResult] = await connection.query(
      `UPDATE bookings
       SET booking_status = ?, amount_paid = ?, remaining_balance = ?, updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ? AND booking_status = 'Pending'`,
      [newBookingStatus, amountPaid, newRemainingBalance, bookingId],
    );

    if (updateResult.affectedRows === 0) {
      await connection?.rollback();
      return res.status(409).json({
        error: {
          code: "INVALID_STATE",
          message: "Booking has already been processed by another request.",
        },
      });
    }

    const refStr =
      booking.booking_reference ||
      (booking.ai_booking_reference
        ? `#AF-${booking.ai_booking_reference}`
        : `#BK${String(bookingId).padStart(4, "0")}`);
    await logActivity({
      actorUserId: Number(req.auth?.sub) || null,
      actorRole: "Admin",
      activityType: `booking_${newBookingStatus.toLowerCase()}`,
      action: `${newBookingStatus.toLowerCase()} Booking #${refStr.replace(/^#/, "")}`,
      bookingId,
    }, connection);
    await createNotification({
      userId: booking.user_id,
      bookingId,
      type: `booking_${newBookingStatus.toLowerCase()}`,
      title: `Booking ${newBookingStatus}`,
      message: `Your booking (${refStr}) has been ${newBookingStatus.toLowerCase()} after payment verification.`,
      link: `/dashboard?tab=events&bookingId=${bookingId}`,
      sendEmailFn: () =>
        sendBookingConfirmedEmail(booking.email, booking.first_name, {
          booking_reference: refStr,
          event_date: booking.event_date,
          package_name: booking.package_name,
          booking_status: newBookingStatus,
        }),
    }, connection);

    await connection.commit();

    res.status(200).json({
      message: "Booking verified successfully.",
      booking_status: newBookingStatus,
      amount_paid: amountPaid,
      remaining_balance: newRemainingBalance,
    });
  } catch (error) {
    await connection?.rollback();
    if (error.status && error.status < 500) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error("Verify booking failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to verify booking.",
      },
    });
  } finally {
    connection?.release();
  }
}

// Admin dashboard stats (Total Users, Total Feedback, Total Revenue, KPIs, Status Distribution, Trends, Packages)
export async function getAdminStats(req, res) {
  try {
    // Ensure overdue statuses are updated first
    try {
      await autoUpdateOverduePayments();
    } catch (e) {
      console.warn("Auto-update overdue payments warning:", e);
    }

    const [
      [[{ total: totalUsers }]],
      [[{ total: totalFeedback }]],
      [[{ total: totalRevenue }]],
      [[{ total: totalBookings }]],
      [[{ total: pendingBookingsCount }]],
      [[{ total: overduePaymentsCount }]],
      [[{ total: upcomingEventsCount }]],
      [statusRows],
      [pkgRows],
      [sentimentRows],
      [revenueMonthRows],
      [bookingMonthRows],
      [upcomingEventsRows],
      eventsHostedCount,
      averageRating,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'Customer'"),
      pool.query("SELECT COUNT(*) AS total FROM feedback"),
      pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE payment_status = 'Paid'"),
      pool.query("SELECT COUNT(*) AS total FROM bookings"),
      pool.query("SELECT COUNT(*) AS total FROM bookings WHERE booking_status = 'Pending'"),
      pool.query("SELECT COUNT(*) AS total FROM payments WHERE payment_status = 'Overdue' AND payment_type != 'CancellationCharge'"),
      pool.query("SELECT COUNT(*) AS total FROM bookings WHERE event_date >= CURDATE() AND event_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND booking_status NOT IN ('Cancelled', 'Rejected')"),
      pool.query(`
        SELECT
          booking_status AS status,
          COUNT(*) AS count
        FROM bookings
        GROUP BY booking_status
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT
          p.package_id,
          p.package_name AS packageName,
          COUNT(b.booking_id) AS bookingCount,
          COALESCE(SUM(b.total_price), 0) AS totalRevenue
        FROM packages p
        LEFT JOIN bookings b ON p.package_id = b.package_id AND b.booking_status NOT IN ('Cancelled', 'Rejected')
        GROUP BY p.package_id, p.package_name
        ORDER BY bookingCount DESC, totalRevenue DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT
          sentiment_status AS sentiment,
          COUNT(*) AS count
        FROM feedback
        WHERE sentiment_status IN ('Positive', 'Neutral', 'Negative')
        GROUP BY sentiment_status
      `),
      pool.query(`
        SELECT
          DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m') AS monthKey,
          COALESCE(SUM(amount), 0) AS revenue
        FROM payments
        WHERE payment_status = 'Paid'
          AND COALESCE(paid_at, created_at) >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
        GROUP BY monthKey
        ORDER BY monthKey ASC
      `),
      pool.query(`
        SELECT
          DATE_FORMAT(created_at, '%Y-%m') AS monthKey,
          COUNT(*) AS bookings
        FROM bookings
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
        GROUP BY monthKey
        ORDER BY monthKey ASC
      `),
      pool.query(`
        SELECT
          b.booking_id,
          b.booking_reference,
          b.ai_booking_reference,
          b.contact_name,
          b.event_date,
          b.start_time,
          b.number_of_pax,
          b.booking_status,
          b.total_price,
          p.package_name
        FROM bookings b
        LEFT JOIN packages p ON b.package_id = p.package_id
        WHERE b.event_date >= CURDATE()
          AND b.booking_status NOT IN ('Cancelled', 'Rejected')
        ORDER BY b.event_date ASC, b.start_time ASC
        LIMIT 5
      `),
      getEventsHostedCount().catch(() => 0),
      getAverageRating().catch(() => null),
    ]);

    // Build continuous 6-month array for monthly trends
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const monthlyTrends = [];
    const revMap = new Map((revenueMonthRows || []).map((r) => [r.monthKey, parseFloat(r.revenue) || 0]));
    const bkMap = new Map((bookingMonthRows || []).map((r) => [r.monthKey, parseInt(r.bookings, 10) || 0]));

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${yyyy}-${mm}`;
      const label = `${monthNames[d.getMonth()]} ${yyyy}`;
      monthlyTrends.push({
        month: label,
        shortMonth: monthNames[d.getMonth()],
        monthKey: key,
        revenue: revMap.get(key) || 0,
        bookings: bkMap.get(key) || 0,
      });
    }

    // Sentiment breakdown
    const totalAnalyzed = (sentimentRows || []).reduce((sum, r) => sum + r.count, 0);
    let sentimentBreakdown = (sentimentRows || []).map((r) => ({
      sentiment: r.sentiment,
      count: r.count,
      percentage: totalAnalyzed > 0 ? Math.round((r.count / totalAnalyzed) * 100) : 0,
    }));
    if (sentimentBreakdown.length === 0) {
      sentimentBreakdown = [
        { sentiment: "Positive", count: 0, percentage: 0 },
        { sentiment: "Neutral", count: 0, percentage: 0 },
        { sentiment: "Negative", count: 0, percentage: 0 },
      ];
    }

    // Booking status color mapping
    const statusColorMap = {
      Pending: "#C4541A",
      Reserved: "#C8922A",
      Confirmed: "#7A8C5C",
      Completed: "#2C1810",
      Cancelled: "#8C827A",
      Rejected: "#D9534F",
    };
    const bookingStatusBreakdown = (statusRows || []).map((r) => ({
      status: r.status,
      count: r.count,
      color: statusColorMap[r.status] || "#7A6E65",
    }));

    res.status(200).json({
      totalUsers: totalUsers || 0,
      totalFeedback: totalFeedback || 0,
      totalRevenue: parseFloat(totalRevenue) || 0,
      totalBookings: totalBookings || 0,
      pendingBookingsCount: pendingBookingsCount || 0,
      overduePaymentsCount: overduePaymentsCount || 0,
      upcomingEventsCount: upcomingEventsCount || 0,
      eventsHostedCount: eventsHostedCount || 0,
      averageRating: averageRating !== null && averageRating !== undefined ? Number(averageRating) : 0,
      sentimentBreakdown,
      bookingStatusBreakdown,
      packagePopularity: (pkgRows || []).map((p) => ({
        packageId: p.package_id,
        packageName: p.packageName,
        bookingCount: parseInt(p.bookingCount, 10) || 0,
        totalRevenue: parseFloat(p.totalRevenue) || 0,
      })),
      monthlyTrends,
      upcomingEventsPreview: (upcomingEventsRows || []).map((b) => ({
        booking_id: b.booking_id,
        booking_reference:
          b.booking_reference ||
          (b.ai_booking_reference ? `#AF-${b.ai_booking_reference}` : `#BK${String(b.booking_id).padStart(4, "0")}`),
        contact_name: b.contact_name,
        event_date: b.event_date instanceof Date ? b.event_date.toISOString().split("T")[0] : String(b.event_date).split("T")[0],
        start_time: b.start_time,
        number_of_pax: b.number_of_pax,
        booking_status: b.booking_status,
        total_price: parseFloat(b.total_price) || 0,
        package_name: b.package_name || "Custom Package",
      })),
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch admin stats.",
      },
    });
  }
}

// Admin recent activity feed
export async function getAdminActivity(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    const [[totalRows]] = await pool.query(
      "SELECT COUNT(*) AS total FROM activity_logs",
    );
    const total = totalRows?.total ?? 0;

    const [rows] = await pool.query(
      `SELECT activity_id, actor_name, actor_role, activity_type, action,
              booking_id, created_at
       FROM activity_logs
       ORDER BY created_at DESC, activity_id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const activities = rows.map((act) => {
      const actDate = new Date(act.created_at);
      const now = new Date();
      const diffMs = now.getTime() - actDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let timestamp;
      if (diffMins < 1) timestamp = "Just now";
      else if (diffMins < 60)
        timestamp = `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
      else if (diffHours < 24)
        timestamp = `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
      else if (diffDays < 7)
        timestamp = `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
      else
        timestamp = actDate.toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        });

      return {
        id: `act-${act.activity_id}`,
        type: act.activity_type,
        user: act.actor_name,
        action: act.action,
        details: "",
        icon: act.activity_type,
        timestamp,
      };
    });

    res.status(200).json({ activities, total, page, limit });
  } catch (error) {
    console.error("Error fetching admin activity:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch admin activity.",
      },
    });
  }
}

// Admin reject booking (Pending -> Rejected)
export async function rejectBooking(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const bookingId = Number(req.params.id);
    const { admin_remarks } = req.body;

    // Lock the booking row so concurrent requests cannot double-process it.
    await connection.beginTransaction();

    const [bookings] = await connection.query(
      `SELECT b.booking_id, b.user_id, b.booking_status, b.booking_reference, b.ai_booking_reference, b.event_date, u.email, u.first_name
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       WHERE b.booking_id = ? LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );

    if (bookings.length === 0) {
      await connection?.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    if (booking.booking_status !== "Pending") {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: `Only pending bookings can be rejected. Current status: ${booking.booking_status}`,
        },
      });
    }

    // Store the rejection as its own distinct status (not 'Cancelled') so the
    // admin "Rejected" filter works and rejections stay distinguishable from
    // customer cancellations. cancellation_requested_at is deliberately left
    // NULL so feedback-eligibility / history logic keeps telling them apart.
    const [updateResult] = await connection.query(
      `UPDATE bookings
       SET booking_status = 'Rejected', updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ? AND booking_status = 'Pending'`,
      [bookingId],
    );

    if (updateResult.affectedRows === 0) {
      await connection?.rollback();
      return res.status(409).json({
        error: {
          code: "INVALID_STATE",
          message: "Booking has already been processed by another request.",
        },
      });
    }

    // Cancel the booking's pending payments so they can no longer be paid,
    // uploaded against, or verified, and never linger as Overdue for a booking
    // that no longer exists. Mirrors requestCancellation / auto-cancel flows.
    await connection.query(
      `UPDATE payments
       SET payment_status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ? AND payment_status IN ('Pending', 'Overdue', 'For_Verification')`,
      [bookingId],
    );

    const refStr =
      booking.booking_reference ||
      (booking.ai_booking_reference
        ? `#AF-${booking.ai_booking_reference}`
        : `#BK${String(bookingId).padStart(4, "0")}`);
    await logActivity({
      actorUserId: Number(req.auth?.sub) || null,
      actorRole: "Admin",
      activityType: "booking_cancelled_admin",
      action: `rejected Booking #${refStr.replace(/^#/, "")}`,
      bookingId,
    }, connection);
    await createNotification({
      userId: booking.user_id,
      bookingId,
      type: "booking_rejected",
      title: "Booking Request Rejected",
      message: `Your booking request (${refStr}) was rejected.${admin_remarks ? ` Reason: ${admin_remarks}` : ""}`,
      link: `/dashboard?tab=events&bookingId=${bookingId}`,
      sendEmailFn: () =>
        sendBookingRejectedEmail(
          booking.email,
          booking.first_name,
          {
            booking_reference: refStr,
            event_date: booking.event_date,
          },
          admin_remarks,
        ),
    }, connection);

    await connection.commit();

    res.status(200).json({
      message: "Booking rejected successfully.",
      booking_status: "Rejected",
    });
  } catch (error) {
    await connection?.rollback();
    if (error.status && error.status < 500) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error("Reject booking failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to reject booking.",
      },
    });
  } finally {
    connection?.release();
  }
}

// Helper to calculate cancellation refund and non-refundable retention
export function calculateCancellationRefund(totalPrice, amountPaid, policyApplied) {
  const total = Number(totalPrice || 0);
  const paid = Number(amountPaid || 0);
  const policy = policyApplied || "standard";

  let nonRefundableRetention = 0;
  if (
    policy === "admin_event_day_cancellation" ||
    policy === "full_refund"
  ) {
    // 100% full refund of all amounts paid (retention = 0)
    nonRefundableRetention = 0;
  } else if (policy === "standard") {
    // Non-refundable reservation fee is ₱5,000 (or total package price if smaller)
    nonRefundableRetention = Math.min(5000.0, total);
  } else if (policy === "5_days_penalty") {
    // 50% of total package price is charged / retained
    nonRefundableRetention = total * 0.5;
  } else if (policy === "1_day_penalty") {
    // 100% of total package price is charged / retained
    nonRefundableRetention = total;
  } else {
    nonRefundableRetention = Math.min(5000.0, total);
  }

  const refundableAmount = Math.max(0, paid - nonRefundableRetention);
  return {
    refundable_amount: refundableAmount,
    non_refundable_retention: nonRefundableRetention,
    has_refund: refundableAmount > 0,
  };
}

// ──────────────────────────────────────────
// Customer: Request booking cancellation
// ──────────────────────────────────────────
export async function requestCancellation(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const bookingId = Number(req.params.id);
    const userId = Number(req.auth.sub);
    const { cancellation_reason } = req.body;

    // Validate cancellation reason is provided
    if (!cancellation_reason || !cancellation_reason.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Cancellation reason is required. Please provide a reason for your cancellation.",
        },
      });
    }

    // Lock the booking row so concurrent requests cannot double-process it.
    await connection.beginTransaction();

    // Get booking details
    const [bookings] = await connection.query(
      `SELECT b.*, p.package_name
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       WHERE b.booking_id = ? LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );

    if (bookings.length === 0) {
      await connection?.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    // Verify user owns this booking
    if (booking.user_id !== userId) {
      await connection?.rollback();
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only cancel your own bookings.",
        },
      });
    }

    // Check if booking is already cancelled or completed
    if (booking.booking_status === "Cancelled") {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: "This booking has already been cancelled.",
        },
      });
    }

    if (booking.booking_status === "Completed") {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: "Cannot cancel a completed booking.",
        },
      });
    }

    if (booking.booking_status === "Rejected") {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "This booking has already been rejected and can no longer be cancelled.",
        },
      });
    }

    // Calculate days before event using Philippine calendar days so the
    // cancellation penalty is not off by one across UTC/PH boundaries.
    const todayMs = new Date(
      `${getPhilippineDateString()}T00:00:00Z`,
    ).getTime();
    const eventMs = new Date(
      `${toPhilippineDateString(booking.event_date)}T00:00:00Z`,
    ).getTime();
    const daysBeforeEvent = Math.round(
      (eventMs - todayMs) / (24 * 60 * 60 * 1000),
    );

    // Determine cancellation policy and calculate amount due
    let policyApplied = "";
    let amountDue = 0;
    let additionalAmountDue = 0;

    if (daysBeforeEvent >= 5) {
      // ≥5 days: Only reservation fee forfeited (already paid)
      policyApplied = "standard";
      amountDue = 0; // Reservation fee already paid, no additional charge
    } else if (daysBeforeEvent >= 2) {
      // 2-4 days before: 50% of total package price
      policyApplied = "5_days_penalty";
      amountDue = booking.total_price * 0.5;
    } else {
      // 1 day or less (including event day): 100% of total package price
      policyApplied = "1_day_penalty";
      amountDue = booking.total_price;
    }

    // Calculate additional amount due (what they still need to pay)
    const amountAlreadyPaid = parseFloat(booking.amount_paid || 0);
    additionalAmountDue = Math.max(0, amountDue - amountAlreadyPaid);

    // Calculate refund if amount paid exceeds non-refundable retention / penalty
    const refundInfo = calculateCancellationRefund(
      booking.total_price,
      amountAlreadyPaid,
      policyApplied,
    );
    const refundableAmount = refundInfo.refundable_amount;

    // Update booking with cancellation details (only if not already cancelled)
    const [cancelUpdate] = await connection.query(
      `UPDATE bookings
       SET booking_status = 'Cancelled',
           cancellation_requested_at = CURRENT_TIMESTAMP,
           cancellation_processed_at = CURRENT_TIMESTAMP,
           cancellation_policy_applied = ?,
           amount_due_on_cancellation = ?,
           cancellation_notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ? AND booking_status NOT IN ('Cancelled', 'Rejected', 'Completed')`,
      [policyApplied, amountDue, cancellation_reason || null, bookingId],
    );

    if (cancelUpdate.affectedRows === 0) {
      await connection?.rollback();
      return res.status(409).json({
        error: {
          code: "INVALID_STATE",
          message: "Booking has already been processed by another request.",
        },
      });
    }

    // Cancel any existing pending payments for this booking FIRST
    // (before inserting new cancellation charge, to avoid cancelling it)
    await connection.query(
      `UPDATE payments
       SET payment_status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ? AND payment_status IN ('Pending', 'Overdue', 'For_Verification')`,
      [bookingId],
    );

    // If additional amount is due, create a cancellation charge payment record
    if (additionalAmountDue > 0) {
      // Defense-in-depth: never insert a second cancellation charge if one
      // already exists (e.g. for a previously cancelled booking).
      const [existingCharges] = await connection.query(
        `SELECT payment_id FROM payments
         WHERE booking_id = ? AND payment_type = 'CancellationCharge'
           AND payment_status IN ('Pending', 'Overdue', 'For_Verification')
         LIMIT 1`,
        [bookingId],
      );

      if (existingCharges.length === 0) {
        // Due date: 7 days from today (Philippine time)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        const dueDateStr = dueDate.toLocaleDateString("sv-SE", {
          timeZone: "Asia/Manila",
        });

        await connection.query(
          `INSERT INTO payments
           (booking_id, payment_type, amount, due_date, payment_status, is_cancellation_charge, admin_remarks)
           VALUES (?, 'CancellationCharge', ?, ?, 'Pending', TRUE, ?)`,
          [
            bookingId,
            additionalAmountDue,
            dueDateStr,
            `Cancellation charge - ${policyApplied}. Event: ${booking.event_date}. Days before event: ${daysBeforeEvent}`,
          ],
        );
      }
    }

    const refStr =
      booking.booking_reference ||
      (booking.ai_booking_reference
        ? `#AF-${booking.ai_booking_reference}`
        : `#BK${String(bookingId).padStart(4, "0")}`);
    await logActivity({
      actorUserId: userId,
      actorRole: "Customer",
      activityType: "booking_cancelled_customer",
      action: `cancelled Booking #${refStr.replace(/^#/, "")}`,
      bookingId,
    }, connection);
    const [userRows] = await connection.query(
      "SELECT email, first_name FROM users WHERE user_id = ?",
      [userId],
    );
    const user = userRows[0];

    const notificationMessage =
      refundableAmount > 0
        ? `Your booking (${refStr}) has been cancelled. You have an eligible refund balance of ₱${refundableAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}. Since automated online refunds are not processed within the system, please contact or visit the restaurant directly to claim your refund.`
        : `Your booking (${refStr}) has been cancelled.`;

    await createNotification({
      userId,
      bookingId,
      type: "booking_cancelled",
      title: "Booking Cancelled",
      message: notificationMessage,
      link: `/dashboard?tab=events&bookingId=${bookingId}`,
      sendEmailFn: () =>
        sendBookingCancelledEmail(
          user?.email,
          user?.first_name,
          {
            booking_reference: refStr,
            refundable_amount: refundableAmount,
          },
          cancellation_reason,
        ),
    }, connection);

    // Prepare response
    const responseData = {
      message: "Booking cancelled successfully.",
      booking_status: "Cancelled",
      booking_id: bookingId,
      booking_reference: booking.booking_reference,
      package_name: booking.package_name,
      event_date: booking.event_date,
      days_before_event: daysBeforeEvent,
      policy_applied: policyApplied,
      total_price: booking.total_price,
      amount_already_paid: amountAlreadyPaid,
      amount_due_on_cancellation: amountDue,
      additional_amount_due: additionalAmountDue,
      refundable_amount: refundableAmount,
      non_refundable_retention: refundInfo.non_refundable_retention,
      cancellation_charge_created: additionalAmountDue > 0,
    };

    await connection.commit();

    res.status(200).json(responseData);
  } catch (error) {
    await connection?.rollback();
    if (error.status && error.status < 500) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error("Request cancellation failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to process cancellation request.",
      },
    });
  } finally {
    connection?.release();
  }
}

// ──────────────────────────────────────────
// Get cancellation details for a booking
// ──────────────────────────────────────────
export async function getCancellationDetails(req, res) {
  try {
    const bookingId = Number(req.params.id);
    const userId = Number(req.auth.sub);

    const [bookings] = await pool.query(
      `SELECT b.*, p.package_name
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       WHERE b.booking_id = ?`,
      [bookingId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    // Verify user owns this booking (or is admin)
    const isAdmin = req.auth.role === "Admin";
    if (booking.user_id !== userId && !isAdmin) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only view your own booking details.",
        },
      });
    }

    await applyBookingPaymentTotals([booking]);

    // Calculate days before event using Philippine calendar days
    const todayMs = new Date(
      `${getPhilippineDateString()}T00:00:00Z`,
    ).getTime();
    const eventMs = new Date(
      `${toPhilippineDateString(booking.event_date)}T00:00:00Z`,
    ).getTime();
    const daysBeforeEvent = Math.round(
      (eventMs - todayMs) / (24 * 60 * 60 * 1000),
    );

    // Determine what policy would apply
    let estimatedPolicy = "";
    let estimatedAmountDue = 0;
    let estimatedAdditionalDue = 0;

    if (daysBeforeEvent >= 5) {
      estimatedPolicy = "standard";
      estimatedAmountDue = 0;
    } else if (daysBeforeEvent >= 2) {
      estimatedPolicy = "5_days_penalty";
      estimatedAmountDue = booking.total_price * 0.5;
    } else {
      estimatedPolicy = "1_day_penalty";
      estimatedAmountDue = booking.total_price;
    }

    const amountAlreadyPaid = parseFloat(booking.amount_paid || 0);
    estimatedAdditionalDue = Math.max(
      0,
      estimatedAmountDue - amountAlreadyPaid,
    );

    const estimatedRefundInfo = calculateCancellationRefund(
      booking.total_price,
      amountAlreadyPaid,
      estimatedPolicy,
    );

    const cancelledRefundInfo =
      booking.booking_status === "Cancelled"
        ? calculateCancellationRefund(
            booking.total_price,
            amountAlreadyPaid,
            booking.cancellation_policy_applied,
          )
        : null;

    // Get cancellation charge payments if any
    const [cancellationPayments] = await pool.query(
      `SELECT * FROM payments
       WHERE booking_id = ? AND payment_type = 'CancellationCharge'
       ORDER BY created_at DESC`,
      [bookingId],
    );

    res.status(200).json({
      booking_id: bookingId,
      booking_reference: booking.booking_reference,
      package_name: booking.package_name,
      event_date: booking.event_date,
      booking_status: booking.booking_status,
      total_price: booking.total_price,
      amount_already_paid: amountAlreadyPaid,
      refundable_amount: cancelledRefundInfo ? cancelledRefundInfo.refundable_amount : 0,
      days_before_event: daysBeforeEvent,
      is_cancelled:
        booking.booking_status === "Cancelled" ||
        booking.booking_status === "Rejected",
      cancellation_details:
        booking.booking_status === "Cancelled"
          ? {
              policy_applied: booking.cancellation_policy_applied,
              amount_due_on_cancellation: booking.amount_due_on_cancellation,
              refundable_amount: cancelledRefundInfo.refundable_amount,
              non_refundable_retention: cancelledRefundInfo.non_refundable_retention,
              cancellation_requested_at: booking.cancellation_requested_at,
              cancellation_processed_at: booking.cancellation_processed_at,
              cancellation_notes: booking.cancellation_notes,
            }
          : null,
      estimated_cancellation:
        booking.booking_status !== "Cancelled" &&
        booking.booking_status !== "Rejected"
          ? {
              policy_would_apply: estimatedPolicy,
              estimated_amount_due: estimatedAmountDue,
              estimated_additional_due: estimatedAdditionalDue,
              estimated_refundable_amount: estimatedRefundInfo.refundable_amount,
              estimated_non_refundable: estimatedRefundInfo.non_refundable_retention,
              cancellation_charge_would_be_created: estimatedAdditionalDue > 0,
            }
          : null,
      cancellation_payments: cancellationPayments,
    });
  } catch (error) {
    console.error("Get cancellation details failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to get cancellation details.",
      },
    });
  }
}

/**
 * Fetch reschedule eligibility and constraints for a booking.
 */
export async function getRescheduleDetails(req, res) {
  try {
    const bookingId = Number(req.params.id);
    const userId = Number(req.auth.sub);
    const userRole = req.auth.role;

    if (!bookingId || isNaN(bookingId)) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid booking ID." },
      });
    }

    const todayStr = getPhilippineDateString();

    const [rows] = await pool.query(
      `SELECT b.*, p.package_name, et.type_name, vs.setup_name,
              u.email AS user_email, u.first_name, u.last_name,
              DATEDIFF(b.event_date, ?) AS days_until_event
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN event_types et ON b.event_type_id = et.event_type_id
       JOIN venue_setups vs ON b.venue_setup_id = vs.venue_setup_id
       JOIN users u ON b.user_id = u.user_id
       WHERE b.booking_id = ?
       LIMIT 1`,
      [todayStr, bookingId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = rows[0];

    // Authorization: customer can only inspect their own booking; admin can inspect any
    if (userRole !== "Admin" && booking.user_id !== userId) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You are not authorized to view this booking." },
      });
    }

    const daysUntilEvent = Number(booking.days_until_event);
    const minLeadTimeDate = getMinimumEventDate(MIN_EVENT_LEAD_DAYS);

    // Rule 1: Booking status must be active (Pending, Reserved, Confirmed)
    const isStatusEligible = ["Pending", "Reserved", "Confirmed"].includes(
      booking.booking_status,
    );

    // Rule 2: 2-Week Window Rule (at least 14 days before current event date)
    const isLeadTimeEligible = daysUntilEvent >= 14;

    let canReschedule = isStatusEligible && isLeadTimeEligible;
    let restrictionReason = null;

    if (!isStatusEligible) {
      restrictionReason = `Bookings with status "${booking.booking_status}" cannot be rescheduled.`;
    } else if (!isLeadTimeEligible) {
      restrictionReason =
        daysUntilEvent <= 0
          ? "This event date has already arrived or passed and cannot be rescheduled."
          : `Rescheduling is only permitted at least 14 days (2 weeks) prior to your event date. Since your event is in ${daysUntilEvent} day(s), rescheduling is locked. Please contact our restaurant staff directly for special assistance.`;
    }

    res.status(200).json({
      booking_id: booking.booking_id,
      booking_reference: booking.booking_reference,
      package_name: booking.package_name,
      current_event_date: toPhilippineDateString(booking.event_date),
      current_start_time: booking.start_time,
      booking_status: booking.booking_status,
      days_until_event: daysUntilEvent,
      can_reschedule: canReschedule,
      restriction_reason: restrictionReason,
      min_event_date: minLeadTimeDate,
      reschedule_count: Number(booking.reschedule_count || 0),
      rescheduled_at: booking.rescheduled_at,
      original_event_date: booking.original_event_date
        ? toPhilippineDateString(booking.original_event_date)
        : null,
    });
  } catch (error) {
    console.error("Error fetching reschedule details:", error);
    res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Failed to fetch reschedule details." },
    });
  }
}

/**
 * Execute booking reschedule inside an atomic transaction.
 */
export async function rescheduleBooking(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const bookingId = Number(req.params.id);
    const userId = Number(req.auth.sub);
    const userRole = req.auth.role;
    const { new_event_date, new_start_time, reschedule_reason } = req.body;

    if (!bookingId || isNaN(bookingId)) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid booking ID." },
      });
    }

    const todayStr = getPhilippineDateString();
    const minLeadTimeStr = getMinimumEventDate(MIN_EVENT_LEAD_DAYS);

    // Validate new event date presence and format
    const newEventDate = String(new_event_date || "").trim();
    if (!isCalendarDate(newEventDate)) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Please select a new event date." },
      });
    }

    if (newEventDate <= todayStr) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Rescheduled event date must be in the future (past or present dates are not allowed).",
        },
      });
    }

    if (newEventDate < minLeadTimeStr) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Rescheduled event date must be scheduled at least 14 days (two weeks) in advance to allow time for the down payment and preparation.",
        },
      });
    }

    // Check store operating days (closed Mondays)
    const [year, month, day] = newEventDate.split("-").map(Number);
    const eventDay = new Date(year, month - 1, day).getDay();
    if (eventDay === 1) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "The store is closed on Mondays. Please choose another date.",
        },
      });
    }

    // Begin atomic transaction
    await connection.beginTransaction();
    await lockBookingCalendar(connection);

    // Fetch booking with locking read
    const [bookingRows] = await connection.query(
      `SELECT b.*, p.package_name, u.email, u.first_name, u.last_name,
              DATEDIFF(b.event_date, ?) AS days_until_event
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN users u ON b.user_id = u.user_id
       WHERE b.booking_id = ?
       LIMIT 1
       FOR UPDATE`,
      [todayStr, bookingId],
    );

    if (bookingRows.length === 0) {
      await connection?.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookingRows[0];

    // Authorization check
    if (userRole !== "Admin" && booking.user_id !== userId) {
      await connection?.rollback();
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You are not authorized to reschedule this booking." },
      });
    }

    // Status check
    if (!["Pending", "Reserved", "Confirmed"].includes(booking.booking_status)) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATUS",
          message: `Cannot reschedule a booking with status "${booking.booking_status}".`,
        },
      });
    }

    const currentEventDateStr = toPhilippineDateString(booking.event_date);
    if (currentEventDateStr <= todayStr) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "RESCHEDULE_WINDOW_CLOSED",
          message: "This event date has already arrived or passed and cannot be rescheduled.",
        },
      });
    }

    // 2-Week Window Rule on the currently scheduled event date
    const daysUntilCurrentEvent = Number(booking.days_until_event);
    if (daysUntilCurrentEvent < 14) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "RESCHEDULE_WINDOW_CLOSED",
          message:
            "Rescheduling is only allowed at least 14 days (2 weeks) prior to your event date. Please contact the restaurant staff for assistance.",
        },
      });
    }

    if (newEventDate === currentEventDateStr) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "The new event date must be different from the currently scheduled date.",
        },
      });
    }

    // Validate start time if provided or preserve current
    const startTime = (new_start_time || booking.start_time || "").trim();
    if (startTime && !isWithinOperatingHours(startTime)) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: getOperatingHoursMessage(),
        },
      });
    }

    // Check date availability (locking read on target date)
    if (await isDateUnavailableForUpdate(connection, newEventDate, booking.booking_id)) {
      await connection?.rollback();
      return res.status(409).json({
        error: {
          code: "DATE_UNAVAILABLE",
          message: "The selected date is no longer available. Please choose another date.",
        },
      });
    }

    // Determine original_event_date to record
    const originalDate = booking.original_event_date
      ? toPhilippineDateString(booking.original_event_date)
      : currentEventDateStr;

    // Update booking event date and reschedule metadata
    await connection.query(
      `UPDATE bookings SET
        event_date = ?,
        start_time = ?,
        original_event_date = ?,
        rescheduled_at = CURRENT_TIMESTAMP,
        reschedule_count = reschedule_count + 1,
        reschedule_reason = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ?`,
      [
        newEventDate,
        startTime,
        originalDate,
        reschedule_reason ? String(reschedule_reason).trim() : null,
        bookingId,
      ],
    );

    // Calculate updated down payment due date (14 days before the new event date)
    const newDateObj = new Date(year, month - 1, day);
    const downPaymentDueDateObj = new Date(newDateObj);
    downPaymentDueDateObj.setDate(downPaymentDueDateObj.getDate() - 14);

    let downPaymentDueDateStr = toPhilippineDateString(downPaymentDueDateObj);
    if (downPaymentDueDateStr < todayStr) {
      downPaymentDueDateStr = todayStr;
    }

    // Synchronize unpaid downpayment due date & reset overdue status if now future
    await connection.query(
      `UPDATE payments SET
        due_date = ?,
        payment_status = CASE WHEN payment_status = 'Overdue' AND ? >= ? THEN 'Pending' ELSE payment_status END,
        updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ? AND payment_type = 'DownPayment' AND payment_status != 'Paid'`,
      [downPaymentDueDateStr, downPaymentDueDateStr, todayStr, bookingId],
    );

    // Synchronize unpaid final payment due date to the new event date
    await connection.query(
      `UPDATE payments SET
        due_date = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ? AND payment_type = 'FinalPayment' AND payment_status != 'Paid'`,
      [newEventDate, bookingId],
    );

    const bookingRef =
      booking.booking_reference || `#BK${String(booking.booking_id).padStart(4, "0")}`;

    // Log admin / customer activity
    await logActivity({
      actorUserId: userId,
      actorRole: userRole,
      activityType: "booking_rescheduled",
      action: `rescheduled booking ${bookingRef} from ${currentEventDateStr} to ${newEventDate} (${startTime})`,
    }, connection);

    // Send in-app notification to customer
    await createNotification({
      userId: booking.user_id,
      bookingId: booking.booking_id,
      type: "booking_rescheduled",
      title: userRole === "Admin" ? "Booking Rescheduled by Admin" : "Event Rescheduled Successfully",
      message: `Your booking ${bookingRef} has been rescheduled from ${currentEventDateStr} to ${newEventDate} at ${startTime}. Payment due dates have been adjusted.`,
      link: `/dashboard`,
    }, connection);

    // Send in-app notification to all active Admins

    const [admins] = await connection.query(
      "SELECT user_id FROM users WHERE role = 'Admin' AND account_status = 'Active'",
    );
    for (const admin of admins) {
      // If an admin performed it, don't notify themselves if they prefer, or notify all admins
      await createNotification({
        userId: admin.user_id,
        bookingId: booking.booking_id,
        type: "booking_rescheduled",
        title: userRole === "Admin" ? "Booking Rescheduled (Admin)" : "Booking Rescheduled by Customer",
        message: `${booking.first_name} ${booking.last_name}'s booking ${bookingRef} was rescheduled from ${currentEventDateStr} to ${newEventDate} (${startTime}).`,
        link: `/admin`,
      }, connection);
    }

    // Send confirmation email to customer
    await queueNotificationEmail(connection, () => sendBookingRescheduledEmail(booking.email, booking.first_name, {
        booking_reference: bookingRef,
        package_name: booking.package_name,
        start_time: startTime,
        downpayment_due_date: downPaymentDueDateStr,
      }, currentEventDateStr, newEventDate, reschedule_reason || null));

    await connection.commit();
    // Auto-complete or auto-cancel if the new event date has already passed
    await autoCompletePastBookings().catch((err) =>
      console.error("autoCompletePastBookings failed post-reschedule:", err),
    );
    await autoCancelUnpaidPastBookings().catch((err) =>
      console.error("autoCancelUnpaidPastBookings failed post-reschedule:", err),
    );

    const [updatedStatusRows] = await pool.query(
      "SELECT booking_status FROM bookings WHERE booking_id = ?",
      [bookingId],
    ).catch(() => [[{ booking_status: booking.booking_status }]]);
    const finalBookingStatus =
      updatedStatusRows[0]?.booking_status || booking.booking_status;

    res.status(200).json({
      message: "Event rescheduled successfully.",
      booking: {
        booking_id: bookingId,
        booking_reference: bookingRef,
        booking_status: finalBookingStatus,
        event_date: newEventDate,
        start_time: startTime,
        original_event_date: originalDate,
        rescheduled_at: new Date().toISOString(),
        reschedule_count: Number(booking.reschedule_count || 0) + 1,
        downpayment_due_date: downPaymentDueDateStr,
      },
    });
  } catch (error) {
    await connection?.rollback();
    if (error.status && error.status < 500) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error("Error rescheduling booking:", error);
    res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Failed to reschedule booking." },
    });
  } finally {
    connection?.release();
  }
}

// ──────────────────────────────────────────
// Admin: Cancel booking on event day with 100% full refund & venue recommendations
// ──────────────────────────────────────────
export async function adminCancelEventDayBooking(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const bookingId = Number(req.params.id);
    const { cancellation_reason } = req.body;

    if (!cancellation_reason || !cancellation_reason.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Cancellation reason is required for event-day cancellation.",
        },
      });
    }

    await connection.beginTransaction();

    const [bookings] = await connection.query(
      `SELECT b.*, p.package_name, u.email, u.first_name, u.last_name
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN users u ON b.user_id = u.user_id
       WHERE b.booking_id = ? LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );

    if (bookings.length === 0) {
      await connection?.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    if (
      booking.booking_status === "Cancelled" ||
      booking.booking_status === "Completed" ||
      booking.booking_status === "Rejected"
    ) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: `Cannot cancel a booking that is already ${booking.booking_status.toLowerCase()}.`,
        },
      });
    }

    const eventDateStr = toPhilippineDateString(booking.event_date);
    const todayStr = getPhilippineDateString();

    // Verify it is on or after the event date in Philippine time
    if (eventDateStr > todayStr) {
      await connection?.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_DATE",
          message: "Same-day event cancellation is only allowed on or after the event day.",
        },
      });
    }

    await applyBookingPaymentTotals([booking], connection);
    const policyApplied = "admin_event_day_cancellation";
    const amountAlreadyPaid = parseFloat(booking.amount_paid || 0);
    const refundableAmount = amountAlreadyPaid; // 100% full refund
    const amountDue = 0; // No penalty or additional charge for client

    // Update booking status
    const [cancelUpdate] = await connection.query(
      `UPDATE bookings
       SET booking_status = 'Cancelled',
           amount_paid = ?,
           remaining_balance = ?,
           cancellation_requested_at = CURRENT_TIMESTAMP,
           cancellation_processed_at = CURRENT_TIMESTAMP,
           cancellation_policy_applied = ?,
           amount_due_on_cancellation = ?,
           cancellation_notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ? AND booking_status NOT IN ('Cancelled', 'Rejected', 'Completed')`,
      [amountAlreadyPaid, booking.remaining_balance, policyApplied, amountDue, cancellation_reason.trim(), bookingId],
    );

    if (cancelUpdate.affectedRows === 0) {
      await connection?.rollback();
      return res.status(409).json({
        error: {
          code: "INVALID_STATE",
          message: "Booking has already been processed by another request.",
        },
      });
    }

    // Cancel all unsettled/pending/overdue payments for this booking
    await connection.query(
      `UPDATE payments
       SET payment_status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ? AND payment_status IN ('Pending', 'Overdue', 'For_Verification')`,
      [bookingId],
    );

    const refStr =
      booking.booking_reference ||
      `#BK${String(booking.booking_id).padStart(4, "0")}`;

    const formattedRefund = `₱${refundableAmount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
    })}`;

    // Save the customer alert and email job atomically with the cancellation.
    await createNotification({
      userId: booking.user_id,
      bookingId: booking.booking_id,
      type: "booking_cancelled_admin_event_day",
      title: "Event Cancelled by Admin",
      message: `Your booking (${refStr}) has been cancelled by the administrator. You are entitled to a full 100% refund of ${formattedRefund} (settled directly with the owner). Alternative venue recommendations will be sent by email.`,
      link: `/dashboard?tab=events&bookingId=${booking.booking_id}`,
      sendEmailFn: () => sendAdminEventDayCancelledEmail(
        booking.email, booking.first_name,
        { booking_reference: refStr, event_date: eventDateStr,
          package_name: booking.package_name, amount_paid: amountAlreadyPaid },
        cancellation_reason.trim(),
      ),
    }, connection);
    await connection.commit();

    logActivity({
      actorUserId: Number(req.auth?.sub) || null,
      actorRole: "Admin",
      activityType: "booking_cancelled_admin_event_day",
      action: `cancelled Booking #${refStr.replace(/^#/, "")} on event day (100% full refund)`,
      bookingId: booking.booking_id,
    }).catch((err) =>
      console.error("Activity logging failed (booking_cancelled_admin_event_day):", err),
    );

    res.status(200).json({
      message: "Event-day booking cancelled successfully. Full refund marked for offline settlement and recommendation email queued for delivery.",
      email_status: "queued",
      booking_status: "Cancelled",
      refundable_amount: refundableAmount,
    });
  } catch (error) {
    await connection?.rollback();
    if (error.status && error.status < 500) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    console.error("Admin event-day cancellation failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to process event-day cancellation.",
      },
    });
  } finally {
    connection?.release();
  }
}

