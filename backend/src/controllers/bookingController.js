import { pool } from "../db/pool.js";
import path from "path";
import fs from "fs";
import multer from "multer";

// Create uploads directory if it does not exist
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only image/jpeg, image/png, and image/webp are allowed."));
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Middleware to handle multer file upload errors and validation
export function uploadSingleReceipt(req, res, next) {
  const uploadSingle = upload.single("receipt");

  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: {
            code: "FILE_TOO_LARGE",
            message: "Image exceeds the maximum allowed size of 5 MB.",
          },
        });
      }
      return res.status(400).json({
        error: {
          code: "INVALID_FILE_UPLOAD",
          message: err.message || "Failed to upload file.",
        },
      });
    }
    next();
  });
}

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
        ai_booking_reference
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)`,
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

// Upload payment receipt image for a booking
export async function uploadReceipt(req, res) {
  try {
    const bookingId = Number(req.params.id);
    const userId = Number(req.auth.sub);

    if (!req.file) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "No receipt image was uploaded." },
      });
    }

    // Verify booking belongs to authenticated user
    const [bookings] = await pool.query(
      "SELECT user_id, booking_summary, booking_status FROM bookings WHERE booking_id = ? LIMIT 1",
      [bookingId]
    );

    if (bookings.length === 0) {
      // Remove uploaded file if booking doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];
    if (booking.user_id !== userId && req.auth.role !== "Admin") {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Unauthorized to update this booking." },
      });
    }

    let summaryObj = {};
    try {
      summaryObj = JSON.parse(booking.booking_summary || "{}");
    } catch {
      summaryObj = {};
    }

    // Clean previous receipt if it exists
    if (summaryObj.receipt_path) {
      const oldPath = path.join(process.cwd(), summaryObj.receipt_path);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.error("Failed to delete old receipt:", e);
        }
      }
    }

    // Save filename/path relative to backend root
    summaryObj.receipt_path = `uploads/${req.file.filename}`;
    summaryObj.receipt_uploaded_at = new Date().toISOString();
    delete summaryObj.rejection_reason; // Remove rejection reason on re-upload

    await pool.query(
      "UPDATE bookings SET booking_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?",
      [JSON.stringify(summaryObj), bookingId]
    );

    res.status(200).json({
      message: "Receipt uploaded successfully.",
      receipt_path: summaryObj.receipt_path,
    });
  } catch (error) {
    console.error("Receipt upload failed:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to save payment receipt." },
    });
  }
}

// Verify payment receipt (Admin only)
export async function verifyPayment(req, res) {
  try {
    const bookingId = Number(req.params.id);

    // Get booking
    const [bookings] = await pool.query(
      "SELECT booking_summary, booking_status FROM bookings WHERE booking_id = ? LIMIT 1",
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];
    let summaryObj = {};
    try {
      summaryObj = JSON.parse(booking.booking_summary || "{}");
    } catch {
      summaryObj = {};
    }

    if (!summaryObj.receipt_path) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "No payment receipt uploaded yet to verify." },
      });
    }

    summaryObj.payment_verified_at = new Date().toISOString();
    delete summaryObj.rejection_reason;

    await pool.query(
      "UPDATE bookings SET booking_status = 'Confirmed', booking_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?",
      [JSON.stringify(summaryObj), bookingId]
    );

    res.status(200).json({
      message: "Booking confirmed successfully.",
      booking_status: "Confirmed",
    });
  } catch (error) {
    console.error("Verify payment failed:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to verify payment." },
    });
  }
}

// Reject payment receipt (Admin only)
export async function rejectPayment(req, res) {
  try {
    const bookingId = Number(req.params.id);
    const { reason } = req.body;

    if (!reason || String(reason).trim() === "") {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Rejection reason is required." },
      });
    }

    // Get booking
    const [bookings] = await pool.query(
      "SELECT booking_summary, booking_status FROM bookings WHERE booking_id = ? LIMIT 1",
      [bookingId]
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const booking = bookings[0];
    let summaryObj = {};
    try {
      summaryObj = JSON.parse(booking.booking_summary || "{}");
    } catch {
      summaryObj = {};
    }

    summaryObj.rejection_reason = String(reason).trim();
    summaryObj.receipt_rejected_at = new Date().toISOString();

    await pool.query(
      "UPDATE bookings SET booking_status = 'Pending', booking_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?",
      [JSON.stringify(summaryObj), bookingId]
    );

    res.status(200).json({
      message: "Booking payment rejected successfully.",
      booking_status: "Pending",
      rejection_reason: summaryObj.rejection_reason,
    });
  } catch (error) {
    console.error("Reject payment failed:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to reject payment." },
    });
  }
}
