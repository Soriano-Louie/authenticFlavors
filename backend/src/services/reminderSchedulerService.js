import { pool } from "../db/pool.js";
import { createNotification } from "./notificationService.js";
import { ACTIVE_BOOKING_STATUSES } from "./availabilityService.js";
import {
  autoCancelUnpaidPastBookings,
  autoCompletePastBookings,
} from "../controllers/bookingController.js";
import {
  sendEventReminderEmail,
  sendFeedbackReminderEmail,
  sendUpcomingPaymentReminder,
  sendPaymentDueToday,
  sendPaymentOverdueNotice,
} from "./emailService.js";

/**
 * Checks and dispatches reminders for upcoming events (7 days and 1 day before).
 */
async function checkEventReminders() {
  try {
    // Select active bookings (Reserved or Confirmed) — every confirmed/upcoming
    // event should be reminded about, whether or not it is fully paid yet.
    const [bookings] = await pool.query(
      `SELECT b.booking_id, b.user_id, b.event_date, b.booking_reference, b.ai_booking_reference,
              u.email, u.first_name, p.package_name,
              DATEDIFF(b.event_date, CURDATE()) AS days_left
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       LEFT JOIN packages p ON b.package_id = p.package_id
       WHERE b.booking_status IN (?, ?)
         AND DATEDIFF(b.event_date, CURDATE()) IN (7, 1)`,
      ACTIVE_BOOKING_STATUSES,
    );

    for (const b of bookings) {
      const daysLeft = b.days_left;
      const type = daysLeft === 7 ? "event_reminder_7d" : "event_reminder_1d";
      const bookingRef =
        b.booking_reference || (b.ai_booking_reference ? `#AF-${b.ai_booking_reference}` : `#BK${String(b.booking_id).padStart(4, "0")}`);

      // Check if notification already sent for this booking and type
      const [existing] = await pool.query(
        "SELECT notification_id FROM notifications WHERE booking_id = ? AND type = ?",
        [b.booking_id, type],
      );

      if (existing.length === 0) {
        const title = `Event Reminder: ${daysLeft} Day${daysLeft > 1 ? "s" : ""} Away!`;
        const message = `Your scheduled event (${bookingRef}) is in ${daysLeft} day${daysLeft > 1 ? "s" : ""}. We look forward to serving you!`;

        await createNotification({
          userId: b.user_id,
          bookingId: b.booking_id,
          type,
          title,
          message,
          link: `/dashboard?tab=events&bookingId=${b.booking_id}`,
          sendEmailFn: () =>
            sendEventReminderEmail(b.email, b.first_name, {
              booking_reference: bookingRef,
              event_date: b.event_date,
              package_name: b.package_name,
            }, daysLeft),
        });
      }
    }
  } catch (error) {
    console.error("[ReminderScheduler] Error checking event reminders:", error);
  }
}

/**
 * Checks and dispatches reminders for payment due dates (3 days prior, due today, overdue).
 */
async function checkPaymentReminders() {
  try {
    const [payments] = await pool.query(
      `SELECT p.payment_id, p.booking_id, p.payment_type, p.amount, p.due_date, p.payment_status,
              b.user_id, b.booking_reference, b.ai_booking_reference,
              u.email, u.first_name,
              DATEDIFF(p.due_date, CURDATE()) AS days_until_due
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       JOIN users u ON b.user_id = u.user_id
       WHERE p.payment_status IN ('Pending', 'Overdue')
         AND b.booking_status NOT IN ('Cancelled', 'Rejected')`,
    );

    for (const p of payments) {
      const daysUntil = p.days_until_due;
      const bookingRef =
        p.booking_reference || (p.ai_booking_reference ? `#AF-${p.ai_booking_reference}` : `#BK${String(p.booking_id).padStart(4, "0")}`);
      const paymentTypeLabel =
        p.payment_type === "Reservation"
          ? "Reservation Fee"
          : p.payment_type === "DownPayment"
            ? "Down Payment"
            : "Final Payment";
      const formattedAmount = `₱${Number(p.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

      let reminderType = null;
      let title = "";
      let message = "";
      let sendEmailFn = null;

      if (daysUntil === 3) {
        reminderType = `payment_due_3d_${p.payment_id}`;
        title = `${paymentTypeLabel} Due in 3 Days`;
        message = `Your ${paymentTypeLabel} of ${formattedAmount} for booking ${bookingRef} is due in 3 days. Please upload your payment receipt.`;
        sendEmailFn = () =>
          sendUpcomingPaymentReminder(p.email, p.first_name, {
            payment_type: p.payment_type,
            amount: p.amount,
            due_date: p.due_date,
            booking_reference: bookingRef,
          });
      } else if (daysUntil === 0 && p.payment_status === "Pending") {
        reminderType = `payment_due_today_${p.payment_id}`;
        title = `${paymentTypeLabel} Due Today`;
        message = `Your ${paymentTypeLabel} of ${formattedAmount} for booking ${bookingRef} is due today! Please settle payment to keep your booking active.`;
        sendEmailFn = () =>
          sendPaymentDueToday(p.email, p.first_name, {
            payment_type: p.payment_type,
            amount: p.amount,
            due_date: p.due_date,
            booking_reference: bookingRef,
          });
      } else if (daysUntil < 0) {
        // Mark payment as Overdue if not already
        if (p.payment_status !== "Overdue") {
          await pool.query(
            "UPDATE payments SET payment_status = 'Overdue' WHERE payment_id = ?",
            [p.payment_id],
          );
        }

        reminderType = `payment_overdue_${p.payment_id}_${Math.abs(daysUntil)}d`;
        // Send overdue notification once every 3 days overdue to avoid spamming
        if (Math.abs(daysUntil) % 3 === 1 || Math.abs(daysUntil) === 1) {
          title = `Overdue Payment Notice: ${paymentTypeLabel}`;
          message = `Your ${paymentTypeLabel} of ${formattedAmount} for booking ${bookingRef} is overdue by ${Math.abs(daysUntil)} day(s). Settle immediately to avoid cancellation.`;
          sendEmailFn = () =>
            sendPaymentOverdueNotice(p.email, p.first_name, {
              payment_type: p.payment_type,
              amount: p.amount,
              due_date: p.due_date,
              overdue_days: Math.abs(daysUntil),
              booking_reference: bookingRef,
            });
        } else {
          reminderType = null;
        }
      }

      if (reminderType) {
        const [existing] = await pool.query(
          "SELECT notification_id FROM notifications WHERE booking_id = ? AND type = ?",
          [p.booking_id, reminderType],
        );

        if (existing.length === 0) {
          await createNotification({
            userId: p.user_id,
            bookingId: p.booking_id,
            type: reminderType,
            title,
            message,
            link: `/dashboard?tab=events&bookingId=${p.booking_id}`,
            sendEmailFn,
          });
        }
      }
    }
  } catch (error) {
    console.error("[ReminderScheduler] Error checking payment reminders:", error);
  }
}

/**
 * Checks for completed events that haven't received feedback and dispatches reminders.
 */
async function checkFeedbackReminders() {
  try {
    const [bookings] = await pool.query(
      `SELECT b.booking_id, b.user_id, b.booking_reference, b.ai_booking_reference,
              u.email, u.first_name, p.package_name
       FROM bookings b
       JOIN users u ON b.user_id = u.user_id
       LEFT JOIN packages p ON b.package_id = p.package_id
       LEFT JOIN feedback f ON b.booking_id = f.booking_id
       WHERE (b.booking_status = 'Completed' OR (b.booking_status = 'Confirmed' AND b.event_date < CURDATE()))
         AND f.feedback_id IS NULL`,
    );

    for (const b of bookings) {
      const type = "feedback_reminder";
      const bookingRef =
        b.booking_reference || (b.ai_booking_reference ? `#AF-${b.ai_booking_reference}` : `#BK${String(b.booking_id).padStart(4, "0")}`);

      const [existing] = await pool.query(
        "SELECT notification_id FROM notifications WHERE booking_id = ? AND type = ?",
        [b.booking_id, type],
      );

      if (existing.length === 0) {
        await createNotification({
          userId: b.user_id,
          bookingId: b.booking_id,
          type,
          title: "How Was Your Event?",
          message: `We hope your catering for booking ${bookingRef} was wonderful! Please take a minute to leave feedback and rate your experience.`,
          link: "/feedback",
          sendEmailFn: () =>
            sendFeedbackReminderEmail(b.email, b.first_name, {
              booking_reference: bookingRef,
              package_name: b.package_name,
            }),
        });
      }
    }
  } catch (error) {
    console.error("[ReminderScheduler] Error checking feedback reminders:", error);
  }
}

export function startReminderScheduler() {
  // Run checks immediately on startup
  setTimeout(() => {
    autoCompletePastBookings().catch((err) =>
      console.error("[ReminderScheduler] Error auto-completing past bookings:", err),
    );
    checkEventReminders();
    checkPaymentReminders();
    checkFeedbackReminders();
    autoCancelUnpaidPastBookings().catch((err) =>
      console.error("[ReminderScheduler] Error auto-cancelling unpaid past bookings:", err),
    );
  }, 5000);

  // Run checks every 4 hours
  setInterval(() => {
    autoCompletePastBookings().catch((err) =>
      console.error("[ReminderScheduler] Error auto-completing past bookings:", err),
    );
    checkEventReminders();
    checkPaymentReminders();
    checkFeedbackReminders();
    autoCancelUnpaidPastBookings().catch((err) =>
      console.error("[ReminderScheduler] Error auto-cancelling unpaid past bookings:", err),
    );
  }, 4 * 60 * 60 * 1000);
}
