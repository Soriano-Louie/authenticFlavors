import { pool } from "../db/pool.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService.js";
import {
  sendUpcomingPaymentReminder,
  sendPaymentDueToday,
  sendPaymentOverdueNotice,
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
} from "../services/emailService.js";
import { createNotification } from "../services/notificationService.js";
import { logActivity } from "../services/activityService.js";
import { getPhilippineDateTimeString } from "../utils/timezone.js";

// ──────────────────────────────────────────
// Auto-update overdue payments (run on every payment fetch)
// ──────────────────────────────────────────
export async function autoUpdateOverduePayments() {
  await pool.query(
    `UPDATE payments 
     SET payment_status = 'Overdue' 
     WHERE payment_status = 'Pending' 
       AND due_date < CURDATE()`,
  );
}

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
      `SELECT p.*, b.user_id, b.booking_reference
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

    const paymentTypeLabel =
      payment.payment_type === "Reservation"
        ? "Reservation Fee"
        : payment.payment_type === "DownPayment"
          ? "Down Payment"
          : "Final Payment";

    const refStr =
      payment.booking_reference ||
      `#BK${String(payment.booking_id).padStart(4, "0")}`;
    const receiptActionLabel =
      payment.payment_type === "Reservation"
        ? "reservation"
        : payment.payment_type === "DownPayment"
          ? "down payment"
          : "final payment";
    logActivity({
      actorUserId: userId,
      actorRole: "Customer",
      activityType: "receipt_uploaded",
      action: `uploaded the ${receiptActionLabel} receipt for Booking #${refStr.replace(/^#/, "")}`,
      bookingId: payment.booking_id,
    }).catch((err) =>
      console.error("Activity logging failed (receipt_uploaded):", err),
    );

    createNotification({
      userId,
      bookingId: payment.booking_id,
      type: `payment_verification_${payment.payment_type.toLowerCase()}`,
      title: `${paymentTypeLabel} Received`,
      message: `Your ${paymentTypeLabel} receipt has been received and is currently under verification by the admin.`,
      link: `/dashboard?tab=events&bookingId=${payment.booking_id}`,
    }).catch((err) => console.error("Notification creation failed:", err));

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
      `SELECT p.*, b.user_id, b.booking_reference
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

    const paymentTypeLabel =
      payment.payment_type === "Reservation"
        ? "Reservation Fee"
        : payment.payment_type === "DownPayment"
          ? "Down Payment"
          : "Final Payment";

    const refStr =
      payment.booking_reference ||
      `#BK${String(payment.booking_id).padStart(4, "0")}`;
    const receiptActionLabel =
      payment.payment_type === "Reservation"
        ? "reservation"
        : payment.payment_type === "DownPayment"
          ? "down payment"
          : "final payment";
    logActivity({
      actorUserId: userId,
      actorRole: "Customer",
      activityType: "receipt_uploaded",
      action: `uploaded the ${receiptActionLabel} receipt for Booking #${refStr.replace(/^#/, "")}`,
      bookingId: payment.booking_id,
    }).catch((err) =>
      console.error("Activity logging failed (receipt_uploaded):", err),
    );

    createNotification({
      userId,
      bookingId: payment.booking_id,
      type: `payment_verification_${payment.payment_type.toLowerCase()}`,
      title: `${paymentTypeLabel} Received`,
      message: `Your ${paymentTypeLabel} receipt has been received and is currently under verification by the admin.`,
      link: `/dashboard?tab=events&bookingId=${payment.booking_id}`,
    }).catch((err) => console.error("Notification creation failed:", err));

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

    // Require rejection reason when rejecting
    if (action === "reject" && (!admin_remarks || !admin_remarks.trim())) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Rejection reason is required.",
        },
      });
    }

    // Get payment details
    const [payments] = await connection.query(
      `SELECT p.*, b.user_id AS booking_user_id, b.total_price, b.amount_paid, b.remaining_balance, b.booking_status,
              b.booking_reference, b.ai_booking_reference, u.email, u.first_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
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

    const paymentTypeLabel =
      payment.payment_type === "Reservation"
        ? "Reservation Fee"
        : payment.payment_type === "DownPayment"
          ? "Down Payment"
          : "Final Payment";
    const refStr = payment.booking_reference || (payment.ai_booking_reference ? `#AF-${payment.ai_booking_reference}` : `#BK${String(payment.booking_id).padStart(4, "0")}`);
    const formattedAmount = `₱${Number(payment.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

    if (action === "approve") {
      const paidAt = getPhilippineDateTimeString();

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

      const paidActionLabel =
        payment.payment_type === "Reservation"
          ? "reservation"
          : payment.payment_type === "DownPayment"
            ? "down payment"
            : "final payment";
      logActivity({
        actorUserId: adminId,
        actorRole: "Admin",
        activityType: "payment_approved",
        action: `approved the ${paymentTypeLabel} for Booking #${refStr.replace(/^#/, "")}`,
        bookingId: payment.booking_id,
      }).catch((err) =>
        console.error("Activity logging failed (payment_approved):", err),
      );
      logActivity({
        actorUserId: payment.booking_user_id,
        actorRole: "Customer",
        activityType: "payment_paid",
        action: `paid the ${paidActionLabel} for Booking #${refStr.replace(/^#/, "")}`,
        bookingId: payment.booking_id,
      }).catch((err) =>
        console.error("Activity logging failed (payment_paid):", err),
      );

      // 1. Trigger payment approval notification & Brevo email
      createNotification({
        userId: payment.booking_user_id,
        bookingId: payment.booking_id,
        type: `payment_approved_${payment.payment_type.toLowerCase()}`,
        title: `${paymentTypeLabel} Approved ✓`,
        message: `Your payment of ${formattedAmount} for ${paymentTypeLabel} (${refStr}) has been verified and approved.`,
        link: `/dashboard?tab=events&bookingId=${payment.booking_id}`,
        sendEmailFn: () =>
          sendPaymentApprovedEmail(payment.email, payment.first_name, {
            payment_type: payment.payment_type,
            amount: payment.amount,
            booking_reference: refStr,
          }),
      }).catch((err) => console.error("Notification creation failed:", err));

      // 2. Trigger next payment due notification if applicable
      if (payment.payment_type === "Reservation") {
        createNotification({
          userId: payment.booking_user_id,
          bookingId: payment.booking_id,
          type: "down_payment_due",
          title: "Down Payment Is Now Due",
          message: `Your reservation fee is approved! The down payment for booking ${refStr} is now due. Please view your payment schedule.`,
          link: `/dashboard?tab=events&bookingId=${payment.booking_id}`,
        }).catch((err) => console.error("Notification creation failed:", err));
      } else if (payment.payment_type === "DownPayment") {
        createNotification({
          userId: payment.booking_user_id,
          bookingId: payment.booking_id,
          type: "final_payment_due",
          title: "Final Payment Is Now Due",
          message: `Your down payment is approved! The final payment for booking ${refStr} is now due. Please view your payment schedule.`,
          link: `/dashboard?tab=events&bookingId=${payment.booking_id}`,
        }).catch((err) => console.error("Notification creation failed:", err));
      }

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
          getPhilippineDateTimeString(),
          admin_remarks || null,
          paymentId,
        ],
      );

      logActivity({
        actorUserId: adminId,
        actorRole: "Admin",
        activityType: "payment_rejected",
        action: `rejected the ${paymentTypeLabel} for Booking #${refStr.replace(/^#/, "")}`,
        bookingId: payment.booking_id,
      }).catch((err) =>
        console.error("Activity logging failed (payment_rejected):", err),
      );

      createNotification({
        userId: payment.booking_user_id,
        bookingId: payment.booking_id,
        type: `payment_rejected_${payment.payment_type.toLowerCase()}`,
        title: `${paymentTypeLabel} Rejected`,
        message: `Your receipt for ${paymentTypeLabel} (${refStr}) was rejected.${admin_remarks ? ` Reason: ${admin_remarks}` : ""}`,
        link: `/dashboard?tab=events&bookingId=${payment.booking_id}`,
        sendEmailFn: () =>
          sendPaymentRejectedEmail(payment.email, payment.first_name, {
            payment_type: payment.payment_type,
            amount: payment.amount,
            booking_reference: refStr,
          }, admin_remarks),
      }).catch((err) => console.error("Notification creation failed:", err));

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
// Admin: Get overdue payments
// ──────────────────────────────────────────
export async function getOverduePayments(req, res) {
  try {
    await autoUpdateOverduePayments();

    const [payments] = await pool.query(
      `SELECT p.*, b.booking_reference, b.event_date, b.booking_status,
              u.first_name, u.last_name, u.email,
              DATEDIFF(CURDATE(), p.due_date) AS overdue_days
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       WHERE p.payment_status IN ('Pending', 'Overdue')
         AND p.due_date < CURDATE()
       ORDER BY p.due_date ASC`,
    );

    res.status(200).json({ payments });
  } catch (error) {
    console.error("Get overdue payments failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to get overdue payments.",
      },
    });
  }
}

// ──────────────────────────────────────────
// Admin: Send payment reminder email
// ──────────────────────────────────────────
export async function sendPaymentReminder(req, res) {
  try {
    const { paymentId } = req.params;

    const [payments] = await pool.query(
      `SELECT p.*, b.booking_reference,
              u.first_name, u.last_name, u.email
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       WHERE p.payment_id = ?`,
      [paymentId],
    );

    if (payments.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Payment not found." },
      });
    }

    const payment = payments[0];
    const paymentDetails = {
      payment_type: payment.payment_type,
      amount: payment.amount,
      due_date: payment.due_date,
      booking_reference: payment.booking_reference,
      overdue_days: Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(payment.due_date).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      ),
    };

    const fullName = `${payment.first_name} ${payment.last_name}`.trim();

    // Determine which email to send based on overdue status
    if (
      payment.payment_status === "Overdue" ||
      new Date(payment.due_date) < new Date()
    ) {
      await sendPaymentOverdueNotice(payment.email, fullName, paymentDetails);
    } else {
      await sendUpcomingPaymentReminder(
        payment.email,
        fullName,
        paymentDetails,
      );
    }

    res.status(200).json({ message: "Payment reminder sent successfully." });
  } catch (error) {
    console.error("Send payment reminder failed:", error);
    res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Failed to send reminder." },
    });
  }
}

// ──────────────────────────────────────────
// Admin: Cancel booking for overdue payment
// ──────────────────────────────────────────
export async function cancelBookingForOverdue(req, res) {
  const connection = await pool.getConnection();
  try {
    const { paymentId } = req.params;

    // Get the payment and its booking
    const [payments] = await connection.query(
      `SELECT p.*, b.booking_status, b.booking_reference
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

    if (payment.booking_status === "Cancelled") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: "Booking is already cancelled.",
        },
      });
    }

    await connection.beginTransaction();

    // Cancel all unpaid payments for this booking
    await connection.query(
      `UPDATE payments 
       SET payment_status = 'Cancelled'
       WHERE booking_id = ? AND payment_status IN ('Pending', 'Overdue', 'For_Verification')`,
      [payment.booking_id],
    );

    // Cancel the booking
    await connection.query(
      `UPDATE bookings 
       SET booking_status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ?`,
      [payment.booking_id],
    );

    await connection.commit();

    const refStr =
      payment.booking_reference ||
      `#BK${String(payment.booking_id).padStart(4, "0")}`;
    logActivity({
      actorUserId: Number(req.auth?.sub) || null,
      actorRole: "Admin",
      activityType: "booking_cancelled_admin",
      action: `cancelled Booking #${refStr.replace(/^#/, "")} due to overdue payment`,
      bookingId: payment.booking_id,
    }).catch((err) =>
      console.error("Activity logging failed (booking_cancelled_admin):", err),
    );

    res.status(200).json({
      message: "Booking cancelled due to overdue payment.",
      booking_status: "Cancelled",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Cancel booking for overdue failed:", error);
    res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Failed to cancel booking." },
    });
  } finally {
    connection.release();
  }
}

// ──────────────────────────────────────────
// Send scheduled payment reminders (called by cron)
// ──────────────────────────────────────────
export async function sendScheduledPaymentReminders() {
  try {
    await autoUpdateOverduePayments();

    // Send reminder for payments due in 3 days
    const [upcomingPayments] = await pool.query(
      `SELECT p.*, b.booking_reference,
              u.first_name, u.last_name, u.email
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       WHERE p.payment_status IN ('Pending', 'Overdue')
         AND p.due_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)`,
    );

    for (const payment of upcomingPayments) {
      try {
        const fullName = `${payment.first_name} ${payment.last_name}`.trim();
        await sendUpcomingPaymentReminder(payment.email, fullName, {
          payment_type: payment.payment_type,
          amount: payment.amount,
          due_date: payment.due_date,
          booking_reference: payment.booking_reference,
        });
      } catch (err) {
        console.error(
          "Failed to send upcoming reminder for payment:",
          payment.payment_id,
          err,
        );
      }
    }

    // Send "due today" emails
    const [dueTodayPayments] = await pool.query(
      `SELECT p.*, b.booking_reference,
              u.first_name, u.last_name, u.email
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       WHERE p.payment_status IN ('Pending', 'Overdue')
         AND p.due_date = CURDATE()`,
    );

    for (const payment of dueTodayPayments) {
      try {
        const fullName = `${payment.first_name} ${payment.last_name}`.trim();
        await sendPaymentDueToday(payment.email, fullName, {
          payment_type: payment.payment_type,
          amount: payment.amount,
          due_date: payment.due_date,
          booking_reference: payment.booking_reference,
        });
      } catch (err) {
        console.error(
          "Failed to send due today notice for payment:",
          payment.payment_id,
          err,
        );
      }
    }

    // Send overdue notices for payments 1+ day past due
    const [overduePayments] = await pool.query(
      `SELECT p.*, b.booking_reference,
              u.first_name, u.last_name, u.email,
              DATEDIFF(CURDATE(), p.due_date) AS overdue_days
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       WHERE p.payment_status IN ('Pending', 'Overdue')
         AND p.due_date < CURDATE()`,
    );

    for (const payment of overduePayments) {
      try {
        const fullName = `${payment.first_name} ${payment.last_name}`.trim();
        await sendPaymentOverdueNotice(payment.email, fullName, {
          payment_type: payment.payment_type,
          amount: payment.amount,
          due_date: payment.due_date,
          booking_reference: payment.booking_reference,
          overdue_days: payment.overdue_days,
        });
      } catch (err) {
        console.error(
          "Failed to send overdue notice for payment:",
          payment.payment_id,
          err,
        );
      }
    }

    return {
      upcomingSent: upcomingPayments.length,
      dueTodaySent: dueTodayPayments.length,
      overdueSent: overduePayments.length,
    };
  } catch (error) {
    console.error("Send scheduled payment reminders failed:", error);
    throw error;
  }
}

// ──────────────────────────────────────────
// Get all payments for a booking
// ──────────────────────────────────────────
export async function getBookingPayments(req, res) {
  try {
    // Auto-update overdue payments before returning
    await autoUpdateOverduePayments();

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
