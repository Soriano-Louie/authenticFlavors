import { pool } from "../db/pool.js";

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
    } = req.body;

    // 1. Basic validation
    if (!package_id || !event_type_name || !number_of_pax || !contact_name || !contact_email || !event_date || !start_time) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Missing required booking details." },
      });
    }

    if (!Array.isArray(menu_selections) || menu_selections.length === 0) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Menu selections are required." },
      });
    }

    // 2. Validate event date is not in the past
    const todayStr = new Date().toISOString().split("T")[0];
    if (event_date < todayStr) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Event date cannot be in the past." },
      });
    }

    // Start database transaction
    await connection.beginTransaction();

    // 3. Resolve event_type_id
    const [eventTypes] = await connection.query(
      "SELECT event_type_id FROM event_types WHERE type_name = ? AND status = 'Active'",
      [event_type_name]
    );
    if (eventTypes.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid or inactive event type." },
      });
    }
    const event_type_id = eventTypes[0].event_type_id;

    // 4. Resolve venue_setup_id
    const primarySetupName = venue_setup_name || (Array.isArray(venue_setup_names) && venue_setup_names[0]) || "Standard Setup";
    const [venueSetups] = await connection.query(
      "SELECT venue_setup_id FROM venue_setups WHERE setup_name = ? AND status = 'Active'",
      [primarySetupName]
    );
    if (venueSetups.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid or inactive venue setup." },
      });
    }
    const venue_setup_id = venueSetups[0].venue_setup_id;

    // 5. Retrieve base price from DB
    const [pricingRows] = await connection.query(
      "SELECT price FROM package_pricing WHERE package_id = ? AND pax_count = ?",
      [package_id, number_of_pax]
    );
    if (pricingRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Selected guest count tier is not available for this package." },
      });
    }
    const basePrice = parseFloat(pricingRows[0].price);

    // 6. Resolve menu selections and check additional prices
    let resolvedMenuSelections = [];
    let additionalPriceSum = 0;

    for (const itemName of menu_selections) {
      const [itemRows] = await connection.query(
        "SELECT menu_item_id, category_id, additional_price FROM menu_items WHERE item_name = ? AND availability_status = 'Active'",
        [itemName]
      );
      if (itemRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: `Menu item '${itemName}' is not available.` },
        });
      }
      resolvedMenuSelections.push(itemRows[0]);
      additionalPriceSum += parseFloat(itemRows[0].additional_price || 0);
    }

    // 7. Verify price matching
    const calculatedTotal = basePrice + additionalPriceSum;
    if (total_price && Math.abs(calculatedTotal - parseFloat(total_price)) > 0.01) {
      await connection.rollback();
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Pricing mismatch. Pricing has been recalculated. Please resubmit." },
      });
    }

    // Generate unique 6-digit ref
    const ai_booking_reference = Math.floor(100000 + Math.random() * 900000);

    // Setup booking summary JSON
    const summaryData = JSON.stringify({
      venue_options: venue_setup_names || [primarySetupName],
      menu_choices_names: menu_selections,
      original_pax: number_of_pax
    });

    // 8. Insert booking
    const [bookingResult] = await connection.query(
      `INSERT INTO bookings (
        user_id, package_id, event_type_id, venue_setup_id, number_of_pax,
        contact_name, contact_email, contact_phone, event_date, start_time,
        allergy_notes, dietary_notes, booking_status, booking_summary, total_price,
        ai_booking_reference, amount_paid, remaining_balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, 0.00, ?)`,
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
        calculatedTotal,
      ]
    );

    const booking_id = bookingResult.insertId;

    // 9. Insert menu selections
    for (const item of resolvedMenuSelections) {
      await connection.query(
        `INSERT INTO booking_menu_selections (booking_id, category_id, menu_item_id)
         VALUES (?, ?, ?)`,
        [booking_id, item.category_id, item.menu_item_id]
      );
    }

    // 10. Automatically create THREE payment records
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localToday = (new Date(Date.now() - tzOffset)).toISOString().split("T")[0];

    const eventDateObj = new Date(event_date);
    const downPaymentDateObj = new Date(eventDateObj);
    downPaymentDateObj.setDate(eventDateObj.getDate() - 14);
    const downPaymentDueDate = downPaymentDateObj.toISOString().split("T")[0];

    const reservationFee = 5000.00;
    const remainingVal = calculatedTotal - reservationFee;
    const downPaymentVal = remainingVal * 0.50;
    const finalPaymentVal = remainingVal - downPaymentVal;

    // Insert Reservation
    await connection.query(
      `INSERT INTO payments (booking_id, payment_type, amount, due_date, payment_status)
       VALUES (?, 'Reservation', ?, ?, 'Pending')`,
      [booking_id, reservationFee, localToday]
    );

    // Insert Down Payment
    await connection.query(
      `INSERT INTO payments (booking_id, payment_type, amount, due_date, payment_status)
       VALUES (?, 'DownPayment', ?, ?, 'Pending')`,
      [booking_id, downPaymentVal, downPaymentDueDate]
    );

    // Insert Final Payment
    await connection.query(
      `INSERT INTO payments (booking_id, payment_type, amount, due_date, payment_status)
       VALUES (?, 'FinalPayment', ?, ?, 'Pending')`,
      [booking_id, finalPaymentVal, event_date]
    );

    await connection.commit();

    res.status(201).json({
      message: "Booking submitted successfully.",
      booking_id,
      total_price: calculatedTotal,
      ai_booking_reference,
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

// Fetch all bookings for authenticated customer
export async function getBookings(req, res) {
  try {
    const userId = Number(req.auth.sub);

    const [bookings] = await pool.query(
      `SELECT b.*, p.package_name, et.type_name, vs.setup_name
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN event_types et ON b.event_type_id = et.event_type_id
       JOIN venue_setups vs ON b.venue_setup_id = vs.venue_setup_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [userId]
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
          [booking.booking_id]
        );

        return {
          ...booking,
          menu_selections: menuSelections,
        };
      })
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
    const [bookings] = await pool.query(
      `SELECT b.*, p.package_name, et.type_name, vs.setup_name,
              u.first_name, u.middle_name, u.last_name
       FROM bookings b
       JOIN packages p ON b.package_id = p.package_id
       JOIN event_types et ON b.event_type_id = et.event_type_id
       JOIN venue_setups vs ON b.venue_setup_id = vs.venue_setup_id
       JOIN users u ON b.user_id = u.user_id
       ORDER BY b.created_at DESC`
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
          [booking.booking_id]
        );

        return {
          ...booking,
          menu_selections: menuSelections,
        };
      })
    );

    res.status(200).json({ bookings: bookingsWithDetails });
  } catch (error) {
    console.error("Error fetching admin bookings:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch admin bookings." },
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
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];
    
    // Check if event date has finished
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const todayStr = (new Date(Date.now() - tzOffset)).toISOString().split("T")[0];
    const eventDateStr = new Date(booking.event_date).toISOString().split("T")[0];
    
    if (eventDateStr > todayStr) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Cannot complete an event that has not finished yet." },
      });
    }

    if (booking.booking_status !== "Confirmed" && booking.booking_status !== "Reserved") {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Only reserved or confirmed bookings can be marked as completed." },
      });
    }

    await pool.query(
      "UPDATE bookings SET booking_status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?",
      [bookingId]
    );

    res.status(200).json({
      message: "Booking marked as completed successfully.",
      booking_status: "Completed",
    });
  } catch (error) {
    console.error("Complete booking failed:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to mark booking as completed." },
    });
  }
}
