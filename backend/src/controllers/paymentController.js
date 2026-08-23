import { pool } from "../db/pool.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService.js";
import {
  sendUpcomingPaymentReminder,
  sendPaymentOverdueNotice,
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
  sendBookingCancelledEmail,
} from "../services/emailService.js";
import { createNotification } from "../services/notificationService.js";
import { logActivity } from "../services/activityService.js";
import { getPhilippineDateTimeString, getPhilippineDateString } from "../utils/timezone.js";
import { isDateUnavailable } from "../services/availabilityService.js";

// ──────────────────────────────────────────
// Auto-update overdue payments (run on every payment fetch)
// ──────────────────────────────────────────
export async function autoUpdateOverduePayments() {
  // CancellationCharge rows are excluded: they are short-lived debts created
  // on cancellation and must not be swept into the overdue-cancel flow.
  await pool.query(
    `UPDATE payments 
     SET payment_status = 'Overdue' 
     WHERE payment_status = 'Pending' 
       AND payment_type != 'CancellationCharge'
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
  let uploadResult = null;
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

    // Cancellation charges are settled in person (verified by the admin in
    // cash). No receipt is ever uploaded against them.
    if (payment.payment_type === "CancellationCharge") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Cancellation charges are settled in person with the admin — please contact the restaurant to arrange payment.",
        },
      });
    }

    // Allow upload for pending, rejected, or overdue payments. Overdue is
    // included so customers can still settle after the due date and let the
    // admin verify the receipt.
    const UPLOADABLE_STATUSES = ["Pending", "Rejected", "Overdue"];
    if (!UPLOADABLE_STATUSES.includes(payment.payment_status)) {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Receipt can only be uploaded for pending, rejected, or overdue payments.",
        },
      });
    }

    // Upload to Cloudinary FIRST. The old receipt asset is only deleted after
    // the new row is persisted, so a re-upload can never leave a broken
    // receipt_url if the new upload or the DB write fails (2.8).
    const result = await uploadToCloudinary(req.file.buffer, "receipts");
    uploadResult = result;

    // Remember the previous asset so it can be deleted best-effort after commit.
    const oldReceiptPublicId = payment.receipt_public_id;

    // Re-check the payment status under lock before persisting, so a slow
    // Cloudinary upload can never overwrite a payment the admin just verified.
    await connection.beginTransaction();
    const [lockedPayments] = await connection.query(
      `SELECT payment_id, payment_status FROM payments
       WHERE payment_id = ? FOR UPDATE`,
      [payment_id],
    );
    const lockedPayment = lockedPayments[0];
    if (
      !lockedPayment ||
      !UPLOADABLE_STATUSES.includes(lockedPayment.payment_status)
    ) {
      await connection.rollback();
      if (result?.public_id) {
        await deleteFromCloudinary(result.public_id).catch(() => {});
      }
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Receipt can only be uploaded for pending, rejected, or overdue payments.",
        },
      });
    }

    const [receiptUpdate] = await connection.query(
      `UPDATE payments 
       SET receipt_url = ?, 
           receipt_public_id = ?, 
           receipt_uploaded_at = CURRENT_TIMESTAMP,
           payment_status = 'For_Verification',
           payment_reference = NULL,
           payment_method = 'Receipt'
       WHERE payment_id = ? AND payment_status IN ('Pending', 'Rejected', 'Overdue')`,
      [result.secure_url, result.public_id, payment_id],
    );

    if (receiptUpdate.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: "Payment status changed while uploading. Please try again.",
        },
      });
    }

    await connection.commit();

    // The new receipt is now live in the DB — delete the replaced asset
    // best-effort (never fail the request if Cloudinary cleanup errors).
    if (oldReceiptPublicId) {
      deleteFromCloudinary(oldReceiptPublicId).catch((delErr) =>
        console.error(
          "Failed to delete replaced receipt on Cloudinary:",
          delErr,
        ),
      );
    }

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
    await connection.rollback();
    // If a receipt was uploaded to Cloudinary but the transaction failed,
    // remove the orphaned file so it never lingers without a DB reference.
    if (uploadResult?.public_id) {
      await deleteFromCloudinary(uploadResult.public_id).catch((delErr) =>
        console.error(
          "Failed to clean up orphaned receipt on Cloudinary:",
          delErr,
        ),
      );
    }
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

    // Cancellation charges are settled in person (verified by the admin in
    // cash). No receipt is ever uploaded against them.
    if (payment.payment_type === "CancellationCharge") {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Cancellation charges are settled in person with the admin — please contact the restaurant to arrange payment.",
        },
      });
    }

    // Allow upload for pending, rejected, or overdue payments. Overdue is
    // included so customers can still settle after the due date and let the
    // admin verify the receipt.
    const UPLOADABLE_STATUSES = ["Pending", "Rejected", "Overdue"];
    if (!UPLOADABLE_STATUSES.includes(payment.payment_status)) {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Receipt can only be uploaded for pending, rejected, or overdue payments.",
        },
      });
    }

    // Remember the previous asset so it can be deleted best-effort after the
    // new receipt row is persisted (2.8).
    const oldReceiptPublicId = payment.receipt_public_id;

    const [receiptUpdate] = await connection.query(
      `UPDATE payments 
       SET receipt_url = ?, 
           receipt_public_id = ?, 
           receipt_uploaded_at = CURRENT_TIMESTAMP,
           payment_status = 'For_Verification',
           payment_reference = NULL,
           payment_method = 'Receipt'
       WHERE payment_id = ? AND payment_status IN ('Pending', 'Rejected', 'Overdue')`,
      [receipt_url, receipt_public_id || null, payment_id],
    );

    if (receiptUpdate.affectedRows === 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: "Payment status changed while uploading. Please try again.",
        },
      });
    }

    // New receipt is live — delete the replaced Cloudinary asset best-effort.
    if (oldReceiptPublicId && oldReceiptPublicId !== receipt_public_id) {
      deleteFromCloudinary(oldReceiptPublicId).catch((delErr) =>
        console.error(
          "Failed to delete replaced receipt on Cloudinary:",
          delErr,
        ),
      );
    }

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
    const { action, admin_remarks, approve_without_receipt } = req.body;

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

    // Require admin remarks when approving without receipt
    if (action === "approve" && approve_without_receipt && (!admin_remarks || !admin_remarks.trim())) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Admin remarks are required when approving without a receipt.",
        },
      });
    }

    // Only allow approve_without_receipt for FinalPayment type
    if (approve_without_receipt && action === "approve") {
      const [paymentTypeCheck] = await pool.query(
        "SELECT payment_type FROM payments WHERE payment_id = ?",
        [paymentId]
      );
      if (paymentTypeCheck.length === 0) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Payment not found." },
        });
      }
      if (paymentTypeCheck[0].payment_type !== "FinalPayment") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Approving without receipt is only allowed for Final Payment.",
          },
        });
      }
    }

    // Lock the payment row so a payment cannot be verified twice concurrently.
    await connection.beginTransaction();

    // Get payment details
    const [payments] = await connection.query(
      `SELECT p.*, b.user_id AS booking_user_id, b.total_price, b.amount_paid, b.remaining_balance, b.booking_status,
              b.booking_reference, b.ai_booking_reference, b.event_date, u.email, u.first_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       WHERE p.payment_id = ?
       FOR UPDATE`,
      [paymentId],
    );

    if (payments.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Payment not found." },
      });
    }

    const payment = payments[0];

    // A receipt can be verified while For_Verification, or while Overdue if a
    // receipt was already uploaded (covers payments that went overdue after
    // the receipt was submitted). A receipt is required either way.
    // Exception: FinalPayment can be approved without receipt when approve_without_receipt is true
    const VERIFIABLE_STATUSES = ["For_Verification", "Overdue"];
    const APPROVE_WITHOUT_RECEIPT_STATUSES = ["Pending", "Overdue"];
    
    if (approve_without_receipt && action === "approve" && payment.payment_type === "FinalPayment") {
      if (!APPROVE_WITHOUT_RECEIPT_STATUSES.includes(payment.payment_status)) {
        await connection.rollback();
        return res.status(400).json({
          error: {
            code: "INVALID_STATE",
            message:
              "Final Payment can only be approved without receipt when status is Pending or Overdue. Current status: " +
              payment.payment_status,
          },
        });
      }
    } else {
      if (
        !payment.receipt_url ||
        !VERIFIABLE_STATUSES.includes(payment.payment_status)
      ) {
        await connection.rollback();
        return res.status(400).json({
          error: {
            code: "INVALID_STATE",
            message:
              "Only payments awaiting verification with an uploaded receipt can be verified. Current status: " +
              payment.payment_status,
          },
        });
      }
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

      // Determine allowed statuses based on whether we're approving without receipt
      const allowedStatuses = approve_without_receipt && payment.payment_type === "FinalPayment"
        ? ['Pending', 'Overdue']
        : ['For_Verification', 'Overdue'];

      // Set payment method to Cash when approving without receipt, otherwise keep existing or set to Receipt
      const paymentMethod = approve_without_receipt && payment.payment_type === "FinalPayment"
        ? 'Cash'
        : (payment.payment_method || 'Receipt');

      // Update payment as paid (guarded so it can only happen once)
      const [payUpdate] = await connection.query(
        `UPDATE payments 
         SET payment_status = 'Paid', 
             paid_at = ?, 
             verified_by = ?, 
             verified_at = ?,
             admin_remarks = ?,
             payment_method = ?
         WHERE payment_id = ? AND payment_status IN (${allowedStatuses.map(() => '?').join(',')})`,
        [paidAt, adminId, paidAt, admin_remarks || null, paymentMethod, paymentId, ...allowedStatuses],
      );

      if (payUpdate.affectedRows === 0) {
        await connection.rollback();
        return res.status(409).json({
          error: {
            code: "INVALID_STATE",
            message: "Payment has already been verified by another request.",
          },
        });
      }

      // Update booking: add amount_paid, reduce remaining_balance, update status
      // Money is rounded to cents after every operation (2.13).
      const round2 = (n) => Math.round(n * 100) / 100;
      const newAmountPaid = round2(
        parseFloat(payment.amount_paid) + parseFloat(payment.amount),
      );
      const newRemaining = Math.max(
        round2(parseFloat(payment.total_price) - newAmountPaid),
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
      // Promotion Reserved -> Confirmed once the down payment is settled
      // (state machine option B in the review — match the docs + chatbot copy).
      if (
        payment.payment_type === "DownPayment" &&
        payment.booking_status === "Reserved"
      ) {
        newBookingStatus = "Confirmed";
      }
      // If remaining balance is 0 -> Confirmed
      if (newRemaining <= 0) {
        newBookingStatus = "Confirmed";
      }

      // Only one booking per day is allowed. If this payment would promote a
      // still-pending booking into an active (Reserved/Confirmed) booking,
      // make sure no other booking or admin block occupies the event date.
      if (
        payment.booking_status === "Pending" &&
        newBookingStatus !== "Pending"
      ) {
        if (
          await isDateUnavailable(
            connection,
            payment.event_date,
            payment.booking_id,
          )
        ) {
          await connection.rollback();
          return res.status(409).json({
            error: {
              code: "DATE_UNAVAILABLE",
              message:
                "This date is unavailable (already booked or blocked by the admin). Only one booking per day is allowed.",
            },
          });
        }
      }

      const [bookingUpdate] = await connection.query(
        `UPDATE bookings 
         SET booking_status = ?,
             amount_paid = ?,
             remaining_balance = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_id = ? AND booking_status NOT IN ('Cancelled', 'Rejected', 'Completed')`,
        [newBookingStatus, newAmountPaid, newRemaining, payment.booking_id],
      );

      if (bookingUpdate.affectedRows === 0) {
        await connection.rollback();
        return res.status(409).json({
          error: {
            code: "INVALID_STATE",
            message: "Booking can no longer accept this payment.",
          },
        });
      }

      await connection.commit();

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
      // Reject (guarded so a payment can only be rejected once)
      const [rejUpdate] = await connection.query(
        `UPDATE payments 
         SET payment_status = 'Rejected',
             verified_by = ?,
             verified_at = ?,
             admin_remarks = ?
         WHERE payment_id = ? AND payment_status IN ('For_Verification', 'Overdue')`,
        [
          adminId,
          getPhilippineDateTimeString(),
          admin_remarks || null,
          paymentId,
        ],
      );

      if (rejUpdate.affectedRows === 0) {
        await connection.rollback();
        return res.status(409).json({
          error: {
            code: "INVALID_STATE",
            message: "Payment has already been verified by another request.",
          },
        });
      }

      await connection.commit();

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
    await connection.rollback();
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
    // Keep status freshest possible: flip due Pending rows to Overdue first.
    await autoUpdateOverduePayments();

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
      verified_at: payment.verified_at,
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
         AND p.payment_type != 'CancellationCharge'
         AND b.booking_status NOT IN ('Cancelled', 'Rejected', 'Completed')
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
       WHERE p.payment_id = ? AND p.payment_status IN ('Pending', 'Overdue')`,
      [paymentId],
    );

    if (payments.length === 0) {
      // Make sure the 400 isn't hiding a wrong payment id.
      const [anyPayment] = await pool.query(
        "SELECT payment_status FROM payments WHERE payment_id = ?",
        [paymentId],
      );
      if (anyPayment.length === 0) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Payment not found." },
        });
      }
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Reminders can only be sent for pending or overdue payments.",
        },
      });
    }

    const payment = payments[0];
    // Compare against Philippine calendar days (the same clock the rest of the
    // system uses) instead of server-local time, so a due date that is already
    // "today" in Manila never flips to overdue just because the server is west
    // of UTC.
    const todayStr = getPhilippineDateString();
    const dueStr = String(payment.due_date).slice(0, 10);
    const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
    const dueMs = new Date(`${dueStr}T00:00:00Z`).getTime();
    const overdueDays = Math.max(
      0,
      Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24)),
    );

    const paymentDetails = {
      payment_type: payment.payment_type,
      amount: payment.amount,
      due_date: payment.due_date,
      booking_reference: payment.booking_reference,
      overdue_days: overdueDays,
    };

    const fullName = `${payment.first_name} ${payment.last_name}`.trim();

    // Determine which email to send based on overdue status
    if (payment.payment_status === "Overdue" || dueStr < todayStr) {
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

    // Lock the payment row so a repeated overdue sweep cannot overwrite a
    // booking that was resolved in the meantime.
    await connection.beginTransaction();

    // Get the payment and its booking
    const [payments] = await connection.query(
      `SELECT p.*, b.booking_status, b.booking_reference, b.event_date, b.user_id, u.email, u.first_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       WHERE p.payment_id = ?
       FOR UPDATE`,
      [paymentId],
    );

    if (payments.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Payment not found." },
      });
    }

    const payment = payments[0];

    if (
      payment.booking_status === "Cancelled" ||
      payment.booking_status === "Completed"
    ) {
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: "Booking is already cancelled or completed.",
        },
      });
    }

    // Only unsettled payments can trigger an overdue cancellation.
    if (payment.payment_status === "Paid") {
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: "This payment has already been settled.",
        },
      });
    }

    // Cancel all unsettled installments for this booking. Rows under admin
    // review (For_Verification) are excluded: an in-flight receipt must never
    // be silently destroyed — the admin has already looked at it (2.4).
    await connection.query(
      `UPDATE payments 
       SET payment_status = 'Cancelled'
       WHERE booking_id = ? AND payment_status IN ('Pending', 'Overdue')`,
      [payment.booking_id],
    );

    // Cancel the booking (guarded so it cannot be re-cancelled). Records the
    // cancellation reason so the customer/admin can trace why it was cancelled.
    const [bookingUpdate] = await connection.query(
      `UPDATE bookings 
       SET booking_status = 'Cancelled', cancellation_processed_at = CURRENT_TIMESTAMP,
           cancellation_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE booking_id = ? AND booking_status NOT IN ('Cancelled', 'Rejected', 'Completed')`,
      [
        "Cancelled by an administrator due to overdue payment.",
        payment.booking_id,
      ],
    );

    if (bookingUpdate.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        error: {
          code: "INVALID_STATE",
          message: "Booking has already been processed by another request.",
        },
      });
    }

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

    // Notify the customer so they are never silently cancelled. Mirrors the
    // rejectBooking / auto-cancel flows.
    createNotification({
      userId: payment.user_id,
      bookingId: payment.booking_id,
      type: "booking_cancelled_overdue",
      title: "Booking Cancelled",
      message: `Your booking (${refStr}) was cancelled because a required payment was not settled before the due date.`,
      link: `/dashboard?tab=events&bookingId=${payment.booking_id}`,
      sendEmailFn: () =>
        sendBookingCancelledEmail(
          payment.email,
          payment.first_name,
          {
            booking_reference: refStr,
            event_date: payment.event_date,
          },
          "Your booking was cancelled by an administrator because a required payment was not settled before the due date. If you have already made a payment, please contact us.",
        ),
    }).catch((err) =>
      console.error(
        "Notification creation failed (booking_cancelled_overdue):",
        err,
      ),
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

    // Explicit projection: the endpoint is restricted to the booking owner and
    // admins, so admin_remarks (the rejection reason is meant for the customer)
    // and receipt_uploaded_at are safe to include. Only internal storage
    // metadata (Cloudinary public ids / file names) stays hidden.
    const [payments] = await pool.query(
      `SELECT payment_id, booking_id, payment_type, amount, due_date,
              paid_at, payment_status, payment_reference, payment_method,
              receipt_url, receipt_uploaded_at, admin_remarks,
              is_cancellation_charge, created_at, updated_at,
              CASE WHEN payment_status = 'Overdue'
                   THEN DATEDIFF(CURDATE(), due_date) ELSE 0 END AS overdue_days
       FROM payments WHERE booking_id = ? ORDER BY 
       CASE payment_type 
         WHEN 'Reservation' THEN 1 
         WHEN 'DownPayment' THEN 2 
         WHEN 'FinalPayment' THEN 3 
         ELSE 4 
       END,
       payment_id ASC`,
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
    // Admin list must reflect the true overdue state, not a stale one.
    await autoUpdateOverduePayments();

    // Pagination: cap the page size so large datasets stay responsive.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 1000);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    const [[totalRows]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id`,
    );
    const total = totalRows?.total ?? 0;

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
         p.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    res.status(200).json({ payments, total, page, limit });
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
// Admin: Record a cancellation charge as settled in person (cash)
// ──────────────────────────────────────────
export async function settleCancellationCharge(req, res) {
  const connection = await pool.getConnection();
  try {
    const { paymentId } = req.params;
    const adminId = Number(req.auth.sub);

    await connection.beginTransaction();

    const [payments] = await connection.query(
      `SELECT p.*, b.user_id AS booking_user_id, b.booking_reference,
              b.ai_booking_reference, u.email, u.first_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       WHERE p.payment_id = ?
       FOR UPDATE`,
      [paymentId],
    );

    if (payments.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Payment not found." },
      });
    }

    const payment = payments[0];

    if (payment.payment_type !== "CancellationCharge") {
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Only cancellation charges are settled this way. Use receipt verification for other payment types.",
        },
      });
    }

    if (!["Pending", "Overdue"].includes(payment.payment_status)) {
      await connection.rollback();
      return res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message:
            "Only pending or overdue cancellation charges can be marked as settled.",
        },
      });
    }

    const paidAt = getPhilippineDateTimeString();
    const [settleUpdate] = await connection.query(
      `UPDATE payments
       SET payment_status = 'Paid',
           payment_method = 'Cash',
           paid_at = ?,
           verified_by = ?,
           verified_at = ?
       WHERE payment_id = ? AND payment_status IN ('Pending', 'Overdue')`,
      [paidAt, adminId, paidAt, paymentId],
    );

    if (settleUpdate.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({
        error: {
          code: "INVALID_STATE",
          message: "Payment has already been settled by another request.",
        },
      });
    }

    await connection.commit();

    const refStr =
      payment.booking_reference ||
      (payment.ai_booking_reference
        ? `#AF-${payment.ai_booking_reference}`
        : `#BK${String(payment.booking_id).padStart(4, "0")}`);
    const formattedAmount = `₱${Number(payment.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

    logActivity({
      actorUserId: adminId,
      actorRole: "Admin",
      activityType: "payment_approved",
      action: `recorded the cancellation charge (${formattedAmount}) as settled in cash for Booking #${refStr.replace(/^#/, "")}`,
      bookingId: payment.booking_id,
    }).catch((err) =>
      console.error("Activity logging failed (settle cancellation):", err),
    );

    createNotification({
      userId: payment.booking_user_id,
      bookingId: payment.booking_id,
      type: "payment_approved_cancellationcharge",
      title: "Cancellation Charge Settled",
      message: `Your cancellation charge of ${formattedAmount} (${refStr}) has been settled in person.`,
      link: `/dashboard?tab=events&bookingId=${payment.booking_id}`,
    }).catch((err) => console.error("Notification creation failed:", err));

    res.status(200).json({
      message: "Cancellation charge marked as settled (cash).",
      payment_status: "Paid",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Settle cancellation charge failed:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to settle cancellation charge.",
      },
    });
  } finally {
    connection.release();
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

    const [result] = await pool.query(
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

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: {
          code: "INSTRUCTION_NOT_FOUND",
          message: "Payment instruction not found.",
        },
      });
    }

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
