import { pool } from "../db/pool.js";
import {
  getPhilippineDateString,
  toPhilippineDateString,
} from "../utils/timezone.js";

// Create Booking inside transaction
export async function createBooking(req, res) {
  const connection = await pool.getConnection();
  try {
    const userId = Number(req.auth.sub);
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

    // 2a. Validate event date is at least 14 days (two weeks) from today
    const minLeadTimeDate = new Date();
    minLeadTimeDate.setDate(minLeadTimeDate.getDate() + 14);
    // Format to local date string (YYYY-MM-DD) matching Philippine time
    const minLeadTimeStr = minLeadTimeDate.toLocaleDateString("sv-SE", {
      timeZone: "Asia/Manila",
    });
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

    // Start database transaction
    await connection.beginTransaction();

    // 3. Resolve event_type_id
    const [eventTypes] = await connection.query(
      "SELECT event_type_id FROM event_types WHERE type_name = ? AND status = 'Active'",
      [event_type_name],
    );
    if (eventTypes.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid or inactive event type.",
        },
      });
    }
    const event_type_id = eventTypes[0].event_type_id;

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
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid or inactive venue setup.",
        },
      });
    }
    const venue_setup_id = venueSetups[0].venue_setup_id;

    // 5. Retrieve base price from DB
    const [pricingRows] = await connection.query(
      "SELECT price FROM package_pricing WHERE package_id = ? AND pax_count = ?",
      [package_id, number_of_pax],
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
    const basePrice = parseFloat(pricingRows[0].price);

    // 6. Resolve menu selections and check additional prices
    let resolvedMenuSelections = [];
    let additionalPriceSum = 0;

    for (const itemName of menu_selections) {
      const [itemRows] = await connection.query(
        "SELECT menu_item_id, category_id, additional_price FROM menu_items WHERE item_name = ? AND availability_status = 'Active'",
        [itemName],
      );
      if (itemRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: `Menu item '${itemName}' is not available.`,
          },
        });
      }
      resolvedMenuSelections.push(itemRows[0]);
      additionalPriceSum += parseFloat(itemRows[0].additional_price || 0);
    }

    // 7. Verify price matching
    const calculatedTotal = basePrice + additionalPriceSum;
    if (
      total_price &&
      Math.abs(calculatedTotal - parseFloat(total_price)) > 0.01
    ) {
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Pricing mismatch. Pricing has been recalculated. Please resubmit.",
        },
      });
    }

    // Generate unique 6-digit ref only for AI/chatbot bookings
    const ai_booking_reference = is_ai_booking
      ? Math.floor(100000 + Math.random() * 900000)
      : null;
    const booking_reference = !is_ai_booking
      ? `BK-${Math.floor(100000 + Math.random() * 900000)}`
      : null;

    // Setup booking summary JSON
    const summaryData = JSON.stringify({
      venue_options: venue_setup_names || [primarySetupName],
      menu_choices_names: menu_selections,
      original_pax: number_of_pax,
    });

    // 8. Insert booking
    const [bookingResult] = await connection.query(
      `INSERT INTO bookings (
        user_id, package_id, event_type_id, venue_setup_id, number_of_pax,
        contact_name, contact_email, contact_phone, event_date, start_time,
        allergy_notes, dietary_notes, booking_status, booking_summary, total_price,
        ai_booking_reference, booking_reference, amount_paid, remaining_balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, 0.00, ?)`,
      [
        userId,
        package_id,
        event_type_id,
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
        calculatedTotal,
        ai_booking_reference,
        booking_reference,
        calculatedTotal,
      ],
    );

    const booking_id = bookingResult.insertId;

    // 9. Insert menu selections
    for (const item of resolvedMenuSelections) {
      await connection.query(
        `INSERT INTO booking_menu_selections (booking_id, category_id, menu_item_id)
         VALUES (?, ?, ?)`,
        [booking_id, item.category_id, item.menu_item_id],
      );
    }

    // 10. Automatically create THREE payment records
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const localToday = new Date(Date.now() - tzOffset)
      .toISOString()
      .split("T")[0];

    const eventDateObj = new Date(event_date);
    const downPaymentDateObj = new Date(eventDateObj);
    downPaymentDateObj.setDate(eventDateObj.getDate() - 14);
    const downPaymentDueDate = downPaymentDateObj.toISOString().split("T")[0];

    const reservationFee = 5000.0;
    const remainingVal = calculatedTotal - reservationFee;
    const downPaymentVal = remainingVal * 0.5;
    const finalPaymentVal = remainingVal - downPaymentVal;

    // Insert Reservation
    await connection.query(
      `INSERT INTO payments (booking_id, payment_type, amount, due_date, payment_status)
       VALUES (?, 'Reservation', ?, ?, 'Pending')`,
      [booking_id, reservationFee, localToday],
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

    await connection.commit();

    res.status(201).json({
      message: "Booking submitted successfully.",
      booking_id,
      total_price: calculatedTotal,
      ...(ai_booking_reference ? { ai_booking_reference } : {}),
      ...(booking_reference ? { booking_reference } : {}),
    });
  } catch (error) {
    await connection.rollback();
    console.error("Booking transaction failed:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to create booking." },
    });
  } finally {
    connection.release();
  }
}

// Auto-complete past confirmed/reserved bookings
export async function autoCompletePastBookings() {
  await pool.query(
    `UPDATE bookings SET booking_status = 'Completed', updated_at = CURRENT_TIMESTAMP
     WHERE booking_status IN ('Confirmed', 'Reserved') AND event_date < CURDATE()`,
  );
}

// Fetch all bookings for authenticated customer
export async function getBookings(req, res) {
  try {
    const userId = Number(req.auth.sub);

    // Auto-complete past confirmed bookings before fetching
    await autoCompletePastBookings();

    const [bookings] = await pool.query(
      `SELECT b.*, p.package_name, et.type_name, vs.setup_name
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN event_types et ON b.event_type_id = et.event_type_id
       JOIN venue_setups vs ON b.venue_setup_id = vs.venue_setup_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [userId],
    );

    // Fetch menu selections for each booking
    const bookingsWithDetails = await Promise.all(
      bookings.map(async (booking) => {
        const [menuSelections] = await pool.query(
          `SELECT mi.item_name, mc.category_name
           FROM booking_menu_selections bms
           JOIN menu_items mi ON bms.menu_item_id = mi.menu_item_id
           JOIN menu_categories mc ON bms.category_id = mc.category_id
           WHERE bms.booking_id = ?`,
          [booking.booking_id],
        );

        return {
          ...booking,
          menu_selections: menuSelections,
        };
      }),
    );

    res.status(200).json({ bookings: bookingsWithDetails });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch bookings." },
    });
  }
}

// Fetch all bookings for admin
export async function getAdminBookings(req, res) {
  try {
    // Auto-complete past confirmed bookings before fetching
    await autoCompletePastBookings();

    const [bookings] = await pool.query(
      `SELECT b.*, p.package_name, et.type_name, vs.setup_name,
              u.first_name, u.middle_name, u.last_name
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN event_types et ON b.event_type_id = et.event_type_id
       JOIN venue_setups vs ON b.venue_setup_id = vs.venue_setup_id
       JOIN users u ON b.user_id = u.user_id
       ORDER BY b.created_at DESC`,
    );

    // Fetch menu selections for each booking
    const bookingsWithDetails = await Promise.all(
      bookings.map(async (booking) => {
        const [menuSelections] = await pool.query(
          `SELECT mi.item_name, mc.category_name
           FROM booking_menu_selections bms
           JOIN menu_items mi ON bms.menu_item_id = mi.menu_item_id
           JOIN menu_categories mc ON bms.category_id = mc.category_id
           WHERE bms.booking_id = ?`,
          [booking.booking_id],
        );

        return {
          ...booking,
          menu_selections: menuSelections,
        };
      }),
    );

    res.status(200).json({ bookings: bookingsWithDetails });
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
  try {
    const bookingId = Number(req.params.id);

    // Get booking
    const [bookings] = await pool.query(
      "SELECT event_date, booking_status FROM bookings WHERE booking_id = ? LIMIT 1",
      [bookingId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    // Check if event date has finished (Philippine time)
    const todayStr = getPhilippineDateString();
    const eventDateStr = toPhilippineDateString(booking.event_date);

    if (eventDateStr > todayStr) {
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
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Only reserved or confirmed bookings can be marked as completed.",
        },
      });
    }

    await pool.query(
      "UPDATE bookings SET booking_status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?",
      [bookingId],
    );

    res.status(200).json({
      message: "Booking marked as completed successfully.",
      booking_status: "Completed",
    });
  } catch (error) {
    console.error("Complete booking failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to mark booking as completed.",
      },
    });
  }
}

// Admin verify booking (Pending -> Confirmed)
export async function verifyBooking(req, res) {
  const connection = await pool.getConnection();
  try {
    const bookingId = Number(req.params.id);
    const { admin_remarks } = req.body;

    const [bookings] = await connection.query(
      "SELECT booking_id, booking_status, amount_paid, remaining_balance, total_price FROM bookings WHERE booking_id = ? LIMIT 1",
      [bookingId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    if (booking.booking_status !== "Pending") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: `Only pending bookings can be verified. Current status: ${booking.booking_status}`,
        },
      });
    }

    await connection.beginTransaction();

    const amountPaid = parseFloat(booking.amount_paid || 0);
    const remainingBalance = parseFloat(
      booking.remaining_balance ?? booking.total_price,
    );
    const newRemainingBalance = Math.max(remainingBalance, 0);
    const newBookingStatus =
      newRemainingBalance <= 0 ? "Confirmed" : "Reserved";

    await connection.query(
      `UPDATE bookings 
       SET booking_status = ?, amount_paid = ?, remaining_balance = ?, updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ?`,
      [newBookingStatus, amountPaid, newRemainingBalance, bookingId],
    );

    await connection.commit();

    res.status(200).json({
      message: "Booking verified successfully.",
      booking_status: newBookingStatus,
      amount_paid: amountPaid,
      remaining_balance: newRemainingBalance,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Verify booking failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to verify booking.",
      },
    });
  } finally {
    connection.release();
  }
}

// Admin dashboard stats (Total Users, Total Feedback, Total Revenue, Sentiment Breakdown)
export async function getAdminStats(req, res) {
  try {
    const [[{ total: totalUsers }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM users WHERE role = 'Customer'",
    );
    const [[{ total: totalFeedback }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM feedback",
    );
    const [[{ total: totalRevenue }]] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE payment_status = 'Paid'",
    );

    // Sentiment breakdown from analyzed feedback
    const [sentimentRows] = await pool.query(
      `SELECT 
        sentiment_status AS sentiment,
        COUNT(*) AS count
       FROM feedback 
       WHERE sentiment_status IN ('Positive', 'Neutral', 'Negative')
       GROUP BY sentiment_status`,
    );

    // Total analyzed feedback for percentage calculation
    const totalAnalyzed = sentimentRows.reduce((sum, r) => sum + r.count, 0);
    const sentimentBreakdown = sentimentRows.map((r) => ({
      sentiment: r.sentiment,
      count: r.count,
      percentage:
        totalAnalyzed > 0 ? Math.round((r.count / totalAnalyzed) * 100) : 0,
    }));

    // If no analyzed feedback exists, provide zeros
    if (sentimentBreakdown.length === 0) {
      sentimentBreakdown.push(
        { sentiment: "Positive", count: 0, percentage: 0 },
        { sentiment: "Neutral", count: 0, percentage: 0 },
        { sentiment: "Negative", count: 0, percentage: 0 },
      );
    }

    res.status(200).json({
      totalUsers,
      totalFeedback,
      totalRevenue: parseFloat(totalRevenue),
      sentimentBreakdown,
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
    // New bookings
    const [newBookings] = await pool.query(
      `SELECT CONCAT('act-', 'booking-', b.booking_id) AS id,
              'booking' AS type,
              CONCAT(u.first_name, ' ', u.last_name) AS user,
              'Created new booking' AS action,
              CONCAT(p.package_name, ' - ', DATE_FORMAT(b.event_date, '%M %e, %Y')) AS details,
              CONCAT('Calendar') AS icon,
              b.created_at AS ts
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       JOIN packages p ON b.package_id = p.package_id
       ORDER BY b.created_at DESC
       LIMIT 10`,
    );

    // Feedback submissions
    const [newFeedback] = await pool.query(
      `SELECT CONCAT('act-', 'feedback-', f.feedback_id) AS id,
              'feedback' AS type,
              CONCAT(u.first_name, ' ', u.last_name) AS user,
              'Submitted feedback' AS action,
              CONCAT(f.rating, '-star review') AS details,
              CONCAT('MessageSquare') AS icon,
              f.submitted_at AS ts
       FROM feedback f
       JOIN users u ON f.user_id = u.user_id
       ORDER BY f.submitted_at DESC
       LIMIT 10`,
    );

    // New user registrations
    const [newUsers] = await pool.query(
      `SELECT CONCAT('act-', 'user-', u.user_id) AS id,
              'user' AS type,
              CONCAT(u.first_name, ' ', u.last_name) AS user,
              'New user registered' AS action,
              'Customer account created' AS details,
              CONCAT('Users') AS icon,
              u.created_at AS ts
       FROM users u
       WHERE u.role = 'Customer'
       ORDER BY u.created_at DESC
       LIMIT 10`,
    );

    // Payment verifications (recently paid)
    const [newPayments] = await pool.query(
      `SELECT CONCAT('act-', 'payment-', p.payment_id) AS id,
              'payment' AS type,
              CONCAT(u.first_name, ' ', u.last_name) AS user,
              'Payment submitted' AS action,
              CONCAT(p.payment_type, ' - ₱', FORMAT(p.amount, 2)) AS details,
              CONCAT('DollarSign') AS icon,
              p.paid_at AS ts
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       WHERE p.payment_status = 'Paid'
       ORDER BY p.paid_at DESC
       LIMIT 10`,
    );

    // Combine all activities, sort by timestamp descending, limit to 20
    const allActivities = [
      ...newBookings,
      ...newFeedback,
      ...newUsers,
      ...newPayments,
    ]
      .sort((a, b) => {
        const dateA = new Date(a.ts || 0).getTime();
        const dateB = new Date(b.ts || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 20)
      .map((act) => {
        const now = new Date();
        const actDate = new Date(act.ts);
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
          id: act.id,
          type: act.type,
          user: act.user,
          action: act.action,
          details: act.details,
          icon: act.icon,
          timestamp,
        };
      });

    res.status(200).json({ activities: allActivities });
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

// Admin reject booking (Pending -> Cancelled)
export async function rejectBooking(req, res) {
  const connection = await pool.getConnection();
  try {
    const bookingId = Number(req.params.id);
    const { admin_remarks } = req.body;

    const [bookings] = await connection.query(
      "SELECT booking_id, booking_status FROM bookings WHERE booking_id = ? LIMIT 1",
      [bookingId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];

    if (booking.booking_status !== "Pending") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: `Only pending bookings can be rejected. Current status: ${booking.booking_status}`,
        },
      });
    }

    await connection.beginTransaction();

    await connection.query(
      `UPDATE bookings 
       SET booking_status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ?`,
      [bookingId],
    );

    await connection.commit();

    res.status(200).json({
      message: "Booking rejected successfully.",
      booking_status: "Cancelled",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Reject booking failed:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to reject booking.",
      },
    });
  } finally {
    connection.release();
  }
}
