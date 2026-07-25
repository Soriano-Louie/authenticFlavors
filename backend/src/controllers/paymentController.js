import { pool } from "../db/pool.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService.js";

// ──────────────────────────────────────────
// Get payment instructions for a booking
// ──────────────────────────────────────────
export async function getPaymentInstructions(req, res) {
  try {
    const { bookingId } = req.params;
    const userId = Number(req.auth.sub);

    // Verify user owns this booking
    const [bookings] = await pool.query(
      "SELECT user_id FROM bookings WHERE booking_id = ?",
      [bookingId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const isAdmin = req.auth.role === "Admin";
    if (bookings[0].user_id !== userId && !isAdmin) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only view your own booking payment instructions.",
        },
      });
    }

    const [instructions] = await pool.query(
      "SELECT * FROM payment_instructions WHERE is_active = TRUE",
    );

    res.status(200).json({ instructions });
  } catch (error) {
    console.error("Get payment instructions failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to get payment instructions.",
      },
    });
  }
}

// ──────────────────────────────────────────
// Upload receipt file (customer) — multer + Cloudinary
// ──────────────────────────────────────────
export async function uploadReceiptFile(req, res) {
  const connection = await pool.getConnection();
  try {
    const { payment_id } = req.body;
    const userId = Number(req.auth.sub);

    if (!payment_id) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Payment ID is required." },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Receipt image file is required.",
        },
      });
    }

    // Verify payment belongs to user
    const [payments] = await connection.query(
      `SELECT p.*, b.user_id 
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       WHERE p.payment_id = ?`,
      [payment_id],
    );

    if (payments.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Payment not found." },
      });
    }

    const payment = payments[0];

    if (payment.user_id !== userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only upload receipts for your own payments.",
        },
      });
    }

    // Only allow upload when status is Pending or Rejected
    if (
      payment.payment_status !== "Pending" &&
      payment.payment_status !== "Rejected"
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Receipt can only be uploaded for pending or rejected payments.",
        },
      });
    }

    // Delete old receipt from Cloudinary if re-uploading
    if (payment.receipt_public_id) {
      await deleteFromCloudinary(payment.receipt_public_id);
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, "receipts");

    await connection.query(
      `UPDATE payments 
       SET receipt_url = ?, 
           receipt_public_id = ?, 
           receipt_uploaded_at = CURRENT_TIMESTAMP,
           payment_status = 'For_Verification',
           payment_reference = NULL,
           payment_method = 'Receipt'
       WHERE payment_id = ?`,
      [result.secure_url, result.public_id, payment_id],
    );

    res.status(200).json({
      message: "Receipt uploaded successfully. Awaiting admin verification.",
      payment_status: "For_Verification",
      receipt_url: result.secure_url,
      receipt_public_id: result.public_id,
    });
  } catch (error) {
    console.error("Upload receipt file failed:", error);
    res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Failed to upload receipt." },
    });
  } finally {
    connection.release();
  }
}

// ──────────────────────────────────────────
// Upload receipt URL (customer) — for frontend direct Cloudinary upload
// ──────────────────────────────────────────
export async function uploadReceipt(req, res) {
  const connection = await pool.getConnection();
  try {
    const { payment_id, receipt_url, receipt_public_id } = req.body;
    const userId = Number(req.auth.sub);

    if (!payment_id || !receipt_url) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Payment ID and receipt URL are required.",
        },
      });
    }

    // Verify payment belongs to user
    const [payments] = await connection.query(
      `SELECT p.*, b.user_id 
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       WHERE p.payment_id = ?`,
      [payment_id],
    );

    if (payments.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Payment not found." },
      });
    }

    const payment = payments[0];

    if (payment.user_id !== userId) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only upload receipts for your own payments.",
        },
      });
    }

    // Only allow upload when status is Pending or Rejected
    if (
      payment.payment_status !== "Pending" &&
      payment.payment_status !== "Rejected"
    ) {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Receipt can only be uploaded for pending or rejected payments.",
        },
      });
    }

    await connection.query(
      `UPDATE payments 
       SET receipt_url = ?, 
           receipt_public_id = ?, 
           receipt_uploaded_at = CURRENT_TIMESTAMP,
           payment_status = 'For_Verification',
           payment_reference = NULL,
           payment_method = 'Receipt'
       WHERE payment_id = ?`,
      [receipt_url, receipt_public_id || null, payment_id],
    );

    res.status(200).json({
      message: "Receipt uploaded successfully. Awaiting admin verification.",
      payment_status: "For_Verification",
    });
  } catch (error) {
    console.error("Upload receipt failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to upload receipt.",
      },
    });
  } finally {
    connection.release();
  }
}

// ──────────────────────────────────────────
// Verify receipt (admin approve/reject)
// ──────────────────────────────────────────
export async function verifyReceipt(req, res) {
  const connection = await pool.getConnection();
  try {
    const { paymentId } = req.params;
    const adminId = Number(req.auth.sub);
    const { action, admin_remarks } = req.body;

    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Action must be 'approve' or 'reject'.",
        },
      });
    }

    // Get payment details
    const [payments] = await connection.query(
      `SELECT p.*, b.user_id AS booking_user_id, b.total_price, b.amount_paid, b.remaining_balance, b.booking_status
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       WHERE p.payment_id = ?`,
      [paymentId],
    );

    if (payments.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Payment not found." },
      });
    }

    const payment = payments[0];

    if (payment.payment_status !== "For_Verification") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Only payments awaiting verification can be verified. Current status: " +
            payment.payment_status,
        },
      });
    }

    if (action === "approve") {
      const now = new Date();
      const paidAt = now.toISOString().slice(0, 19).replace("T", " ");

      // Update payment as paid
      await connection.query(
        `UPDATE payments 
         SET payment_status = 'Paid', 
             paid_at = ?, 
             verified_by = ?, 
             verified_at = ?,
             admin_remarks = ?
         WHERE payment_id = ?`,
        [paidAt, adminId, paidAt, admin_remarks || null, paymentId],
      );

      // Update booking: add amount_paid, reduce remaining_balance, update status
      const newAmountPaid =
        parseFloat(payment.amount_paid) + parseFloat(payment.amount);
      const newRemaining = Math.max(
        parseFloat(payment.total_price) - newAmountPaid,
        0,
      );

      let newBookingStatus = payment.booking_status;
      // If this was the Reservation payment and booking is still Pending -> Reserved
      if (
        payment.payment_type === "Reservation" &&
        payment.booking_status === "Pending"
      ) {
        newBookingStatus = "Reserved";
      }
      // If remaining balance is 0 -> Confirmed
      if (newRemaining <= 0) {
        newBookingStatus = "Confirmed";
      }

      await connection.query(
        `UPDATE bookings 
         SET booking_status = ?,
             amount_paid = ?,
             remaining_balance = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_id = ?`,
        [newBookingStatus, newAmountPaid, newRemaining, payment.booking_id],
      );

      res.status(200).json({
        message: "Payment approved successfully.",
        payment_status: "Paid",
        booking_status: newBookingStatus,
        amount_paid: newAmountPaid,
        remaining_balance: newRemaining,
      });
    } else {
      // Reject
      await connection.query(
        `UPDATE payments 
         SET payment_status = 'Rejected',
             verified_by = ?,
             verified_at = ?,
             admin_remarks = ?
         WHERE payment_id = ?`,
        [
          adminId,
          new Date().toISOString().slice(0, 19).replace("T", " "),
          admin_remarks || null,
          paymentId,
        ],
      );

      res.status(200).json({
        message: "Payment rejected. Customer can upload a new receipt.",
        payment_status: "Rejected",
      });
    }
  } catch (error) {
    console.error("Verify receipt failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to verify receipt.",
      },
    });
  } finally {
    connection.release();
  }
}

// ──────────────────────────────────────────
// Get payment status
// ──────────────────────────────────────────
export async function getPaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;
    const userId = Number(req.auth.sub);

    const [payments] = await pool.query(
      `SELECT p.*, b.user_id 
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       WHERE p.payment_id = ?`,
      [paymentId],
    );

    if (payments.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Payment not found." },
      });
    }

    const payment = payments[0];

    const isAdmin = req.auth.role === "Admin";
    if (payment.user_id !== userId && !isAdmin) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only view your own payments.",
        },
      });
    }

    res.status(200).json({
      payment_status: payment.payment_status,
      paid_at: payment.paid_at,
      payment_method: payment.payment_method,
      payment_reference: payment.payment_reference,
      receipt_url: payment.receipt_url,
      receipt_uploaded_at: payment.receipt_uploaded_at,
      verified_by: payment.verified_by,
      verified_at: payment.verified_at,
      admin_remarks: payment.admin_remarks,
    });
  } catch (error) {
    console.error("Get payment status failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to get payment status.",
      },
    });
  }
}

// ──────────────────────────────────────────
// Get all payments for a booking
// ──────────────────────────────────────────
export async function getBookingPayments(req, res) {
  try {
    const { bookingId } = req.params;
    const userId = Number(req.auth.sub);

    // Verify user owns this booking
    const [bookings] = await pool.query(
      "SELECT user_id FROM bookings WHERE booking_id = ?",
      [bookingId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Booking not found." },
      });
    }

    const isAdmin = req.auth.role === "Admin";
    if (bookings[0].user_id !== userId && !isAdmin) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You can only view your own booking payments.",
        },
      });
    }

    const [payments] = await pool.query(
      `SELECT * FROM payments WHERE booking_id = ? ORDER BY 
       CASE payment_type 
         WHEN 'Reservation' THEN 1 
         WHEN 'DownPayment' THEN 2 
         WHEN 'FinalPayment' THEN 3 
       END`,
      [bookingId],
    );

    res.status(200).json({ payments });
  } catch (error) {
    console.error("Get booking payments failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to get booking payments.",
      },
    });
  }
}

// ──────────────────────────────────────────
// Get all payments for admin dashboard
// ──────────────────────────────────────────
export async function getAllPayments(req, res) {
  try {
    const [payments] = await pool.query(
      `SELECT p.*, b.user_id AS booking_user_id, b.booking_status, b.event_date,
              u.first_name, u.last_name, u.email
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       ORDER BY 
         CASE p.payment_status
           WHEN 'For_Verification' THEN 0
           WHEN 'Pending' THEN 1
           WHEN 'Rejected' THEN 2
           WHEN 'Paid' THEN 3
           ELSE 4
         END,
         p.created_at DESC`,
    );

    res.status(200).json({ payments });
  } catch (error) {
    console.error("Get all payments failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to get all payments.",
      },
    });
  }
}

// ──────────────────────────────────────────
// Admin: Update payment instructions
// ──────────────────────────────────────────
export async function updatePaymentInstructions(req, res) {
  try {
    const { instruction_id, instruction_text, account_details, is_active } =
      req.body;

    if (!instruction_id) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Instruction ID is required.",
        },
      });
    }

    await pool.query(
      `UPDATE payment_instructions 
       SET instruction_text = COALESCE(?, instruction_text),
           account_details = COALESCE(?, account_details),
           is_active = COALESCE(?, is_active)
       WHERE instruction_id = ?`,
      [
        instruction_text || null,
        account_details || null,
        is_active ?? null,
        instruction_id,
      ],
    );

    res.status(200).json({ message: "Payment instructions updated." });
  } catch (error) {
    console.error("Update payment instructions failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to update payment instructions.",
      },
    });
  }
}
