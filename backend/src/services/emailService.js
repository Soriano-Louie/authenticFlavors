import { env } from "../config/env.js";
import { formatPhilippineDate } from "../utils/timezone.js";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function buildSender() {
  return {
    email: env.senderEmail,
    name: env.senderName,
  };
}

// Escape user-provided text before inserting into email HTML so a malicious
// value (e.g. a rejection reason or profile name) cannot inject markup.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendBrevoEmail(to, subject, htmlContent) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      signal: controller.signal,
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: buildSender(),
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data.message || data.error || `Brevo API error: ${response.status}`;
    throw new Error(`Brevo email send failed: ${message}`);
  }

  return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendVerificationCode(email, code) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Verify Your Email Address</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Thank you for creating an account. Use the verification code below to complete your registration.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #C8922A; background: #F5F0E8; padding: 12px 24px; border-radius: 8px; font-family: 'Courier New', monospace;">
            ${code}
          </span>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          This code will expire in <strong>10 minutes</strong>.
        </p>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0;">
          If you did not create an account, please ignore this email.
        </p>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(
    email,
    "Verify Your Email – Authentic Flavors by Chef Ramos",
    html,
  );
}

export async function sendEmailChangeVerificationEmail(email, code) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Confirm Your Email Change</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          We received a request to change the email address associated with your
          Authentic Flavors account to this address. Use the verification code below
          to confirm the change.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #C8922A; background: #F5F0E8; padding: 12px 24px; border-radius: 8px; font-family: 'Courier New', monospace;">
            ${code}
          </span>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          This code will expire in <strong>10 minutes</strong>.
        </p>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          Your current email address will remain unchanged until you verify this code.
        </p>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0;">
          If you did not request this change, please ignore this email. Your email address
          will not be changed.
        </p>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(
    email,
    "Confirm Your Email Change – Authentic Flavors by Chef Ramos",
    html,
  );
}

export async function sendPasswordResetEmail(email, firstName, resetToken) {
  const resetUrl = `${env.frontendUrl}/reset-password?token=${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Password Reset Request</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          We received a request to reset your password. Click the button below to set a new password.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          This link will expire in <strong>1 hour</strong>.
        </p>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          If you did not request a password reset, please ignore this email. Your password will remain unchanged.
        </p>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0;">
          For security, do not share this link with anyone.
        </p>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(
    email,
    "Reset Your Password – Authentic Flavors by Chef Ramos",
    html,
  );
}

// ──────────────────────────────────────────
// Payment Reminder Emails
// ──────────────────────────────────────────

/**
 * Send a reminder email 3 days before a payment is due.
 */
export async function sendUpcomingPaymentReminder(
  email,
  firstName,
  paymentDetails,
) {
  const { payment_type, amount, due_date, booking_reference } = paymentDetails;
  const formattedAmount = `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  const formattedDate = formatPhilippineDate(due_date);
  const paymentTypeLabel =
    payment_type === "Reservation"
      ? "Reservation Fee"
      : payment_type === "DownPayment"
        ? "Down Payment"
        : "Final Payment";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Upcoming Payment Reminder</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          This is a friendly reminder that your <strong>${paymentTypeLabel}</strong> is due in <strong>3 days</strong>.
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2C1810;">
            <tr><td style="padding: 4px 0;">Payment Type:</td><td style="font-weight: bold; text-align: right;">${paymentTypeLabel}</td></tr>
            <tr><td style="padding: 4px 0;">Amount:</td><td style="font-weight: bold; text-align: right; color: #C8922A;">${formattedAmount}</td></tr>
            <tr><td style="padding: 4px 0;">Due Date:</td><td style="font-weight: bold; text-align: right;">${formattedDate}</td></tr>
            ${booking_reference ? `<tr><td style="padding: 4px 0;">Booking Ref:</td><td style="font-weight: bold; text-align: right;">${booking_reference}</td></tr>` : ""}
          </table>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          Please log in to your account and upload your payment receipt before the due date to avoid any issues with your booking.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(
    email,
    `Reminder: ${paymentTypeLabel} Due in 3 Days – Authentic Flavors`,
    html,
  );
}

/**
 * Send an email on the day a payment is due.
 */
export async function sendPaymentDueToday(email, firstName, paymentDetails) {
  const { payment_type, amount, due_date, booking_reference } = paymentDetails;
  const formattedAmount = `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  const formattedDate = formatPhilippineDate(due_date);
  const paymentTypeLabel =
    payment_type === "Reservation"
      ? "Reservation Fee"
      : payment_type === "DownPayment"
        ? "Down Payment"
        : "Final Payment";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Payment Due Today</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Your <strong>${paymentTypeLabel}</strong> of <strong>${formattedAmount}</strong> is due <strong>today</strong>.
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2C1810;">
            <tr><td style="padding: 4px 0;">Payment Type:</td><td style="font-weight: bold; text-align: right;">${paymentTypeLabel}</td></tr>
            <tr><td style="padding: 4px 0;">Amount:</td><td style="font-weight: bold; text-align: right; color: #C8922A;">${formattedAmount}</td></tr>
            <tr><td style="padding: 4px 0;">Due Date:</td><td style="font-weight: bold; text-align: right;">${formattedDate}</td></tr>
            ${booking_reference ? `<tr><td style="padding: 4px 0;">Booking Ref:</td><td style="font-weight: bold; text-align: right;">${booking_reference}</td></tr>` : ""}
          </table>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          Please upload your payment receipt today to keep your booking secure. Failure to pay may result in cancellation.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Pay Now
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(
    email,
    `Payment Due Today: ${paymentTypeLabel} – Authentic Flavors`,
    html,
  );
}

/**
 * Send an overdue notice email when a payment is past due.
 */
export async function sendPaymentOverdueNotice(
  email,
  firstName,
  paymentDetails,
) {
  const { payment_type, amount, due_date, overdue_days, booking_reference } =
    paymentDetails;
  const formattedAmount = `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  const daysOverdue = overdue_days || 1;
  const paymentTypeLabel =
    payment_type === "Reservation"
      ? "Reservation Fee"
      : payment_type === "DownPayment"
        ? "Down Payment"
        : "Final Payment";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px; border: 2px solid #C4541A;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #C4541A; color: #F5F0E8; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Payment Overdue</span>
        </div>
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Action Required: Overdue Payment</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #C4541A; font-size: 14px; line-height: 1.6; margin: 0 0 16px; font-weight: bold;">
          Your <strong>${paymentTypeLabel}</strong> of <strong>${formattedAmount}</strong> is now <strong>${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue</strong>.
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2C1810;">
            <tr><td style="padding: 4px 0;">Payment Type:</td><td style="font-weight: bold; text-align: right;">${paymentTypeLabel}</td></tr>
            <tr><td style="padding: 4px 0;">Amount:</td><td style="font-weight: bold; text-align: right; color: #C4541A;">${formattedAmount}</td></tr>
            <tr><td style="padding: 4px 0;">Overdue By:</td><td style="font-weight: bold; text-align: right; color: #C4541A;">${daysOverdue} day${daysOverdue > 1 ? "s" : ""}</td></tr>
            ${booking_reference ? `<tr><td style="padding: 4px 0;">Booking Ref:</td><td style="font-weight: bold; text-align: right;">${booking_reference}</td></tr>` : ""}
          </table>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          <strong>Please settle this payment immediately</strong> to avoid cancellation of your booking. If payment is not received within a reasonable time, we may be forced to cancel your reservation.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C4541A, #8B3A1A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
                Settle Payment Now
              </a>
            </div>
          </div>
          <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
            &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
          </p>
        </div>
      `;

  return sendBrevoEmail(
    email,
    `Overdue Payment: ${paymentTypeLabel} – Authentic Flavors`,
    html,
  );
}

// ──────────────────────────────────────────
// Booking & Payment Lifecycle Email Notifications
// ──────────────────────────────────────────

export async function sendBookingSubmittedEmail(email, firstName, bookingDetails) {
  const { booking_reference, event_date, package_name, guest_count } = bookingDetails;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Booking Request Received</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Thank you for choosing Authentic Flavors! Your booking request <strong>${booking_reference || ""}</strong> has been submitted successfully and is currently under review by our catering team.
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2C1810;">
            ${booking_reference ? `<tr><td style="padding: 4px 0;">Ref Number:</td><td style="font-weight: bold; text-align: right;">${booking_reference}</td></tr>` : ""}
            ${package_name ? `<tr><td style="padding: 4px 0;">Package:</td><td style="font-weight: bold; text-align: right;">${package_name}</td></tr>` : ""}
            <tr><td style="padding: 4px 0;">Event Date:</td><td style="font-weight: bold; text-align: right;">${formattedDate}</td></tr>
            ${guest_count ? `<tr><td style="padding: 4px 0;">Guests:</td><td style="font-weight: bold; text-align: right;">${guest_count} pax</td></tr>` : ""}
          </table>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          We will review your request shortly and notify you once it's confirmed.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            View Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Booking Request Received (${booking_reference || "Authentic Flavors"})`, html);
}

export async function sendBookingConfirmedEmail(email, firstName, bookingDetails) {
  const { booking_reference, event_date, package_name } = bookingDetails;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #C8922A; color: #F5F0E8; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Booking Confirmed</span>
        </div>
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Great news! Your booking is confirmed.</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          We are pleased to inform you that your booking <strong>${booking_reference || ""}</strong> has been officially confirmed by our admin team!
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2C1810;">
            ${booking_reference ? `<tr><td style="padding: 4px 0;">Booking Ref:</td><td style="font-weight: bold; text-align: right;">${booking_reference}</td></tr>` : ""}
            ${package_name ? `<tr><td style="padding: 4px 0;">Package:</td><td style="font-weight: bold; text-align: right;">${package_name}</td></tr>` : ""}
            <tr><td style="padding: 4px 0;">Event Date:</td><td style="font-weight: bold; text-align: right;">${formattedDate}</td></tr>
          </table>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          Please log into your dashboard to check your payment schedule and manage your event details.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Booking Confirmed (${booking_reference || "Authentic Flavors"})`, html);
}

export async function sendBookingRejectedEmail(email, firstName, bookingDetails, reason) {
  const { booking_reference, event_date } = bookingDetails;
  const formattedDate = event_date ? formatPhilippineDate(event_date) : "";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #C4541A;">
        <h2 style="color: #C4541A; font-size: 18px; margin: 0 0 12px;">Booking Status Update</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          We regret to inform you that your booking request <strong>${booking_reference || ""}</strong> could not be accepted at this time.
        </p>
        ${reason ? `
        <div style="background-color: #FFF5F2; border-left: 4px solid #C4541A; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="font-size: 13px; color: #2C1810; margin: 0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
        </div>` : ""}
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          If you have questions or wish to pick an alternative date, please reach out to our team or submit a new request.
        </p>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Booking Update: Request Declined (${booking_reference || "Authentic Flavors"})`, html);
}

export async function sendBookingCancelledEmail(email, firstName, bookingDetails, reason) {
  const { booking_reference, refundable_amount } = bookingDetails || {};
  const hasRefund = Number(refundable_amount) > 0;
  const formattedRefund = hasRefund
    ? `₱${Number(refundable_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
    : "";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Booking Cancellation Notice</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Your booking <strong>${escapeHtml(booking_reference || "")}</strong> has been cancelled.
        </p>
        ${reason ? `
        <div style="background-color: #F5F0E8; padding: 12px 16px; margin: 16px 0; border-radius: 8px;">
          <p style="font-size: 13px; color: #2C1810; margin: 0;"><strong>Cancellation Details:</strong> ${escapeHtml(reason)}</p>
        </div>` : ""}
        ${hasRefund ? `
        <div style="background-color: #7A8C5C15; border: 1px solid #7A8C5C40; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="font-size: 14px; font-weight: bold; color: #2C1810; margin: 0 0 8px;">
            💰 Refund Information
          </p>
          <p style="font-size: 13px; color: #2C1810; line-height: 1.5; margin: 0 0 8px;">
            You have an eligible refund amount of <strong style="color: #7A8C5C; font-size: 15px;">${formattedRefund}</strong>.
          </p>
          <p style="font-size: 12px; color: #555; line-height: 1.5; margin: 0;">
            Please note that automated online refunds are not processed within our web system. To claim your refund, please contact our restaurant directly or talk to our staff in person. Please present your booking reference (<strong>${escapeHtml(booking_reference || "")}</strong>).
          </p>
        </div>` : ""}
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Booking Cancelled (${booking_reference || "Authentic Flavors"})`, html);
}

export async function sendAdminEventDayCancelledEmail(
  email,
  firstName,
  bookingDetails,
  reason,
) {
  const { booking_reference, event_date, package_name, amount_paid } =
    bookingDetails || {};
  const paidAmountNum = Number(amount_paid || 0);
  const formattedRefund = `₱${paidAmountNum.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 24px; margin: 0; font-weight: bold;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0; font-weight: 600;">by Chef Ramos</p>
      </div>

      <div style="background-color: #ffffff; border-radius: 12px; padding: 28px; box-shadow: 0 4px 12px rgba(44, 24, 16, 0.05);">
        <div style="border-bottom: 2px solid #C4541A; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="color: #C4541A; font-size: 20px; margin: 0; font-family: 'Georgia', serif;">Important Notice: Event Cancellation Today</h2>
          <p style="color: #666; font-size: 13px; margin: 4px 0 0;">Booking Ref: <strong>${escapeHtml(booking_reference || "")}</strong></p>
        </div>

        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Dear <strong>${escapeHtml(firstName || "Customer")}</strong>,
        </p>

        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          We deeply regret to inform you that your catering/event booking scheduled for today, <strong>${escapeHtml(event_date || "Today")}</strong>${package_name ? ` (${escapeHtml(package_name)})` : ""}, has been cancelled by our management due to unforeseen circumstances.
        </p>

        ${reason ? `
        <div style="background-color: #FDF2E9; border-left: 4px solid #C4541A; padding: 14px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
          <p style="font-size: 13px; color: #8B3A1A; margin: 0; line-height: 1.5;">
            <strong>Reason for Cancellation:</strong><br/>
            ${escapeHtml(reason)}
          </p>
        </div>` : ""}

        <!-- Full Refund Box -->
        <div style="background-color: #F3F7EE; border: 1.5px solid #7A8C5C; border-radius: 10px; padding: 18px; margin: 20px 0;">
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 18px; margin-right: 8px;">💰</span>
            <h3 style="font-size: 16px; font-weight: bold; color: #2C1810; margin: 0;">
              100% Full Refund Notice
            </h3>
          </div>
          <p style="font-size: 14px; color: #2C1810; margin: 0 0 10px; line-height: 1.5;">
            Because this cancellation was initiated by our management on your event day, you are entitled to a <strong>100% full refund</strong> of all payments made totaling:
          </p>
          <div style="background-color: #ffffff; border: 1px dashed #7A8C5C; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 12px;">
            <span style="font-size: 22px; font-weight: bold; color: #5C7A3E;">${formattedRefund}</span>
          </div>
          <p style="font-size: 12px; color: #4A5A30; line-height: 1.5; margin: 0;">
            <strong>Settlement Method:</strong> Please note that online gateway refunds are not handled automatically by our web portal. <strong>The restaurant owner will coordinate and settle this full refund directly with you</strong> (via direct bank transfer, GCash, or in person). Please keep your booking reference handy.
          </p>
        </div>

        <!-- Venue Recommendations -->
        <div style="margin-top: 28px; border-top: 1px solid #E5DCCF; pt: 20px;">
          <div style="text-align: center; margin: 20px 0 16px;">
            <span style="background-color: #C8922A; color: #ffffff; font-size: 11px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; display: inline-block;">
              Alternative Venues
            </span>
            <h3 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 18px; margin: 10px 0 4px;">
              Recommended Places to Book Today
            </h3>
            <p style="color: #666; font-size: 12px; margin: 0;">
              To help you secure an alternative venue immediately, here are nearby recommended places in Taguig:
            </p>
          </div>

          <!-- Recommendation 1: LOLA CAFE -->
          <div style="background-color: #FAF7F2; border: 1px solid #EADDC8; border-radius: 10px; padding: 16px; margin-bottom: 14px;">
            <h4 style="color: #2C1810; font-size: 15px; margin: 0 0 6px; font-weight: bold;">
              1. LOLA (Lola Cafe)
            </h4>
            <p style="font-size: 12px; color: #555; margin: 0 0 8px; line-height: 1.4;">
              📍 <strong>Address:</strong> Ground Floor, Ayala Malls, Arca South, Taguig, 1630 Metro Manila
            </p>
            <div style="font-size: 12px; color: #444; line-height: 1.6;">
              <div>📞 <strong>Telephone:</strong> <a href="tel:025012620" style="color: #C8922A; text-decoration: none;">(02) 501 2620</a></div>
              <div>✉️ <strong>Email:</strong> <a href="mailto:localefoodgroupe@gmail.com" style="color: #C8922A; text-decoration: none;">localefoodgroupe@gmail.com</a></div>
              <div>💬 <strong>Facebook:</strong> <a href="https://www.facebook.com/lolacafe.ph" target="_blank" style="color: #C4541A; text-decoration: underline;">fb.com/lolacafe.ph</a></div>
              <div style="margin-top: 6px;">
                <a href="https://maps.app.goo.gl/Xoq1bAnKJjmkwXn88?g_st=afm" target="_blank" style="display: inline-block; background-color: #2C1810; color: #F5F0E8; font-size: 11px; padding: 5px 12px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  🗺️ View on Google Maps
                </a>
              </div>
            </div>
          </div>

          <!-- Recommendation 2: TA'GIG -->
          <div style="background-color: #FAF7F2; border: 1px solid #EADDC8; border-radius: 10px; padding: 16px; margin-bottom: 14px;">
            <h4 style="color: #2C1810; font-size: 15px; margin: 0 0 6px; font-weight: bold;">
              2. TA'GIG Restaurant & Events
            </h4>
            <p style="font-size: 12px; color: #555; margin: 0 0 8px; line-height: 1.4;">
              📍 <strong>Address:</strong> Near Medical Center Taguig, Pedro Cayetano Blvd. (former Levi Mariano Ave), Taguig
            </p>
            <div style="font-size: 12px; color: #444; line-height: 1.6;">
              <div>📞 <strong>Phone:</strong> <a href="tel:09164887257" style="color: #C8922A; text-decoration: none;">0916 488 7257</a></div>
              <div>✉️ <strong>Email:</strong> <a href="mailto:tagigrestobar@gmail.com" style="color: #C8922A; text-decoration: none;">tagigrestobar@gmail.com</a></div>
              <div>💬 <strong>Facebook:</strong> <a href="https://www.facebook.com/TagigRestoBar" target="_blank" style="color: #C4541A; text-decoration: underline;">fb.com/TagigRestoBar</a></div>
              <div style="margin-top: 6px;">
                <a href="https://maps.app.goo.gl/SYriNTAr16S1wKz97" target="_blank" style="display: inline-block; background-color: #2C1810; color: #F5F0E8; font-size: 11px; padding: 5px 12px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  🗺️ View on Google Maps
                </a>
              </div>
            </div>
          </div>

          <!-- Recommendation 3: LA LUNA CAFE -->
          <div style="background-color: #FAF7F2; border: 1px solid #EADDC8; border-radius: 10px; padding: 16px; margin-bottom: 14px;">
            <h4 style="color: #2C1810; font-size: 15px; margin: 0 0 6px; font-weight: bold;">
              3. LA LUNA CAFE
            </h4>
            <p style="font-size: 12px; color: #555; margin: 0 0 8px; line-height: 1.4;">
              📍 <strong>Address:</strong> 103 M. L. Quezon Avenue, Taguig, Metro Manila
            </p>
            <div style="font-size: 12px; color: #444; line-height: 1.6;">
              <div>📞 <strong>Phone:</strong> <a href="tel:0282937655" style="color: #C8922A; text-decoration: none;">(02) 8293 7655</a> / <a href="tel:09690906137" style="color: #C8922A; text-decoration: none;">0969 090 6137</a></div>
              <div>🌐 <strong>Website:</strong> <a href="https://lalunacafe.ph" target="_blank" style="color: #C8922A; text-decoration: underline;">lalunacafe.ph</a></div>
              <div>✉️ <strong>Email:</strong> <a href="mailto:lalunacafe@lalunagroup.ph" style="color: #C8922A; text-decoration: none;">lalunacafe@lalunagroup.ph</a></div>
              <div>💬 <strong>Facebook:</strong> <a href="https://www.facebook.com/LaLunaCafeTaguig" target="_blank" style="color: #C4541A; text-decoration: underline;">fb.com/LaLunaCafeTaguig</a></div>
              <div style="margin-top: 6px;">
                <a href="https://maps.app.goo.gl/BzfmLFwxt5WNMoA88" target="_blank" style="display: inline-block; background-color: #2C1810; color: #F5F0E8; font-size: 11px; padding: 5px 12px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  🗺️ View on Google Maps
                </a>
              </div>
            </div>
          </div>

          <!-- Recommendation 4: ORO PLATO -->
          <div style="background-color: #FAF7F2; border: 1px solid #EADDC8; border-radius: 10px; padding: 16px; margin-bottom: 14px;">
            <h4 style="color: #2C1810; font-size: 15px; margin: 0 0 6px; font-weight: bold;">
              4. ORO PLATO
            </h4>
            <p style="font-size: 12px; color: #555; margin: 0 0 8px; line-height: 1.4;">
              📍 <strong>Address:</strong> Phase 4, AFPOVAI, S. Ola, Corner Villamor St, Western Bicutan, Taguig, 1630 Metro Manila
            </p>
            <div style="font-size: 12px; color: #444; line-height: 1.6;">
              <div>📞 <strong>Phone:</strong> <a href="tel:09285548787" style="color: #C8922A; text-decoration: none;">0928 554 8787</a></div>
              <div>🌐 <strong>Website:</strong> <a href="https://oroplato.com" target="_blank" style="color: #C8922A; text-decoration: underline;">oroplato.com</a></div>
              <div>✉️ <strong>Email:</strong> <a href="mailto:oroplato.gueridon@gmail.com" style="color: #C8922A; text-decoration: none;">oroplato.gueridon@gmail.com</a></div>
              <div>💬 <strong>Facebook:</strong> <a href="https://www.facebook.com/oroplato.mnl" target="_blank" style="color: #C4541A; text-decoration: underline;">fb.com/oroplato.mnl</a></div>
              <div style="margin-top: 6px;">
                <a href="https://maps.app.goo.gl/c3osyy1fMp3QdaCG9" target="_blank" style="display: inline-block; background-color: #2C1810; color: #F5F0E8; font-size: 11px; padding: 5px 12px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  🗺️ View on Google Maps
                </a>
              </div>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin: 28px 0 10px;">
          <a href="${env.frontendUrl}/dashboard?tab=events" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            View Booking Status
          </a>
        </div>
      </div>

      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(
    email,
    `URGENT: Booking Cancelled Today - ${booking_reference || "Authentic Flavors"}`,
    html,
  );
}

export async function sendBookingRescheduledEmail(
  email,
  firstName,
  bookingDetails,
  oldEventDate,
  newEventDate,
  reason,
) {
  const {
    booking_reference,
    package_name,
    start_time,
    downpayment_due_date,
  } = bookingDetails;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #7A8C5C; color: #ffffff; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Event Rescheduled</span>
        </div>
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Booking Rescheduled Successfully</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.5; margin: 0 0 16px;">
          Hello ${firstName || "Valued Client"},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.5; margin: 0 0 16px;">
          Your catering booking (<strong>${booking_reference || "Authentic Flavors"}</strong>) has been successfully rescheduled.
        </p>

        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="color: #2C1810; font-size: 13px; margin: 0 0 8px;"><strong>Package:</strong> ${package_name || "Event Package"}</p>
          <p style="color: #C4541A; font-size: 13px; margin: 0 0 8px; text-decoration: line-through;"><strong>Previous Date:</strong> ${oldEventDate}</p>
          <p style="color: #7A8C5C; font-size: 14px; margin: 0 0 8px; font-weight: bold;"><strong>New Event Date:</strong> ${newEventDate}</p>
          <p style="color: #2C1810; font-size: 13px; margin: 0 0 8px;"><strong>Start Time:</strong> ${start_time || "TBD"}</p>
          ${
            downpayment_due_date
              ? `<p style="color: #2C1810; font-size: 13px; margin: 0 0 8px;"><strong>Updated Down Payment Due Date:</strong> ${downpayment_due_date}</p>`
              : ""
          }
          ${
            reason
              ? `<p style="color: #2C1810; font-size: 13px; margin: 0;"><strong>Reason:</strong> ${reason}</p>`
              : ""
          }
        </div>

        <div style="background-color: #7A8C5C15; border-left: 4px solid #7A8C5C; padding: 12px; border-radius: 4px; margin-bottom: 20px;">
          <p style="color: #2C1810; font-size: 12px; margin: 0; line-height: 1.4;">
            <strong>Important Policy Note:</strong> The 50% down payment must be settled at least 2 weeks before your new event date (${newEventDate}), and the remaining 50% balance on the event date itself.
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            View Booking in Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(
    email,
    `Event Rescheduled: ${booking_reference || "Authentic Flavors"} (${newEventDate})`,
    html,
  );
}

export async function sendPaymentApprovedEmail(email, firstName, paymentDetails) {
  const { payment_type, amount, booking_reference } = paymentDetails;
  const formattedAmount = `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  const paymentTypeLabel =
    payment_type === "Reservation"
      ? "Reservation Fee"
      : payment_type === "DownPayment"
        ? "Down Payment"
        : "Final Payment";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #C8922A; color: #F5F0E8; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Payment Approved</span>
        </div>
        <h2 style="color: #C4541A; font-size: 18px; margin: 0 0 12px;">Payment Received & Verified</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Your payment of <strong>${formattedAmount}</strong> for <strong>${paymentTypeLabel}</strong> has been successfully verified and approved.
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2C1810;">
            <tr><td style="padding: 4px 0;">Payment Type:</td><td style="font-weight: bold; text-align: right;">${paymentTypeLabel}</td></tr>
            <tr><td style="padding: 4px 0;">Amount Paid:</td><td style="font-weight: bold; text-align: right; color: #C4541A;">${formattedAmount}</td></tr>
            ${booking_reference ? `<tr><td style="padding: 4px 0;">Booking Ref:</td><td style="font-weight: bold; text-align: right;">${booking_reference}</td></tr>` : ""}
          </table>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            View Account Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `${paymentTypeLabel} Payment Approved – Authentic Flavors`, html);
}

export async function sendPaymentRejectedEmail(email, firstName, paymentDetails, reason) {
  const { payment_type, amount, booking_reference } = paymentDetails;
  const formattedAmount = `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  const paymentTypeLabel =
    payment_type === "Reservation"
      ? "Reservation Fee"
      : payment_type === "DownPayment"
        ? "Down Payment"
        : "Final Payment";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #C4541A;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #C4541A; color: #F5F0E8; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Payment Rejected</span>
        </div>
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Action Required: Payment Rejected</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Your receipt for <strong>${paymentTypeLabel}</strong> (${formattedAmount}) could not be verified by our team.
        </p>
        ${reason ? `
        <div style="background-color: #FFF5F2; border-left: 4px solid #C4541A; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="font-size: 13px; color: #2C1810; margin: 0;"><strong>Rejection Reason:</strong> ${escapeHtml(reason)}</p>
        </div>` : ""}
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          Please log into your dashboard and upload a valid payment proof.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C4541A, #8B3A1A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Re-upload Receipt
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Payment Rejected: ${paymentTypeLabel} – Authentic Flavors`, html);
}

export async function sendEventReminderEmail(email, firstName, bookingDetails, daysBefore) {
  const { booking_reference, event_date, package_name } = bookingDetails;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Upcoming Event Reminder</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          This is an exciting reminder that your catering event with Authentic Flavors is coming up in <strong>${daysBefore} day${daysBefore > 1 ? "s" : ""}</strong>!
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2C1810;">
            ${booking_reference ? `<tr><td style="padding: 4px 0;">Booking Ref:</td><td style="font-weight: bold; text-align: right;">${booking_reference}</td></tr>` : ""}
            ${package_name ? `<tr><td style="padding: 4px 0;">Package:</td><td style="font-weight: bold; text-align: right;">${package_name}</td></tr>` : ""}
            <tr><td style="padding: 4px 0;">Event Date:</td><td style="font-weight: bold; text-align: right; color: #C8922A;">${formattedDate}</td></tr>
          </table>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          Our culinary team is preparing to deliver an unforgettable dining experience for you and your guests.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            View Event Details
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Event Reminder: ${daysBefore} Day${daysBefore > 1 ? "s" : ""} to Go! – Authentic Flavors`, html);
}

export async function sendFeedbackReminderEmail(email, firstName, bookingDetails) {
  const { booking_reference, package_name } = bookingDetails;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">How Was Your Catering Experience?</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          We hope you and your guests loved the food and service from Authentic Flavors! Your feedback means the world to Chef Ramos and our team.
        </p>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 16px;">
          Please take a moment to leave a review and let us know about your experience.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/feedback" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Leave Feedback & Rating
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Share Your Feedback – Authentic Flavors by Chef Ramos`, html);
}

// ──────────────────────────────────────────
// Menu Change Request Email Notifications
// ──────────────────────────────────────────

export async function sendMenuChangeRequestedAdminEmail(adminEmail, details) {
  const { booking_reference, customer_name, event_date, requested_items } = details;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">Admin Portal</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">New Menu Change Request</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Customer <strong>${escapeHtml(customer_name)}</strong> submitted a menu change request for booking <strong>${booking_reference || ""}</strong>.
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2C1810;">
            <tr><td style="padding: 4px 0;">Booking Ref:</td><td style="font-weight: bold; text-align: right;">${booking_reference || ""}</td></tr>
            <tr><td style="padding: 4px 0;">Event Date:</td><td style="font-weight: bold; text-align: right;">${formattedDate}</td></tr>
            <tr><td style="padding: 4px 0;">Requested Items:</td><td style="font-weight: bold; text-align: right;">${escapeHtml(Array.isArray(requested_items) ? requested_items.join(", ") : requested_items)}</td></tr>
          </table>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          Please log into the Admin Dashboard to review and approve or reject this request.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/admin" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Review Request in Admin Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(adminEmail, `Menu Change Request Pending: ${booking_reference || "Authentic Flavors"}`, html);
}

export async function sendMenuChangeApprovedCustomerEmail(email, firstName, details) {
  const { booking_reference, event_date, updated_items } = details;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #C8922A; color: #F5F0E8; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Menu Change Approved</span>
        </div>
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Your Menu Change Was Approved!</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Your requested menu changes for booking <strong>${booking_reference || ""}</strong> (Event Date: <strong>${formattedDate}</strong>) have been approved and updated in our system.
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="font-size: 13px; color: #2C1810; margin: 0 0 8px;"><strong>Updated Menu Selections:</strong></p>
          <p style="font-size: 13px; color: #C4541A; font-weight: bold; margin: 0;">${escapeHtml(Array.isArray(updated_items) ? updated_items.join(", ") : updated_items)}</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            View Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Menu Change Approved: ${booking_reference || "Authentic Flavors"}`, html);
}

export async function sendMenuChangeRejectedCustomerEmail(email, firstName, details, reason) {
  const { booking_reference, event_date } = details;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #C4541A;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #C4541A; color: #F5F0E8; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Menu Change Declined</span>
        </div>
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Menu Change Request Update</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Your menu change request for booking <strong>${booking_reference || ""}</strong> (Event Date: <strong>${formattedDate}</strong>) could not be approved.
        </p>
        ${reason ? `
        <div style="background-color: #FFF5F2; border-left: 4px solid #C4541A; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="font-size: 13px; color: #2C1810; margin: 0;"><strong>Rejection Reason:</strong> ${escapeHtml(reason)}</p>
        </div>` : ""}
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Menu Change Update: Request Declined (${booking_reference || "Authentic Flavors"})`, html);
}

// ──────────────────────────────────────────
// Venue Setup Request Email Notifications
// ──────────────────────────────────────────

export async function sendVenueSetupRequestedAdminEmail(adminEmail, details) {
  const { booking_reference, customer_name, event_date, venue_setup_notes } = details;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">Admin Portal</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">New Venue Setup Request</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Customer <strong>${escapeHtml(customer_name)}</strong> submitted a venue setup request for booking <strong>${booking_reference || ""}</strong>.
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2C1810;">
            <tr><td style="padding: 4px 0;">Booking Ref:</td><td style="font-weight: bold; text-align: right;">${booking_reference || ""}</td></tr>
            <tr><td style="padding: 4px 0;">Event Date:</td><td style="font-weight: bold; text-align: right;">${formattedDate}</td></tr>
          </table>
          <p style="font-size: 13px; color: #2C1810; margin: 12px 0 4px;"><strong>Venue Setup Notes:</strong></p>
          <p style="font-size: 13px; color: #C4541A; margin: 0; white-space: pre-wrap;">${escapeHtml(venue_setup_notes || "")}</p>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          Please log into the Admin Dashboard to review and approve, request changes, or decline this request.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/admin" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Review Request in Admin Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(adminEmail, `Venue Setup Request Pending: ${booking_reference || "Authentic Flavors"}`, html);
}

export async function sendVenueSetupApprovedCustomerEmail(email, firstName, details) {
  const { booking_reference, event_date } = details;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #C8922A; color: #F5F0E8; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Venue Setup Approved</span>
        </div>
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Your Venue Setup Request Was Approved!</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Your venue setup request for booking <strong>${booking_reference || ""}</strong> (Event Date: <strong>${formattedDate}</strong>) has been approved.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            View Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Venue Setup Approved: ${booking_reference || "Authentic Flavors"}`, html);
}

export async function sendVenueSetupChangesRequestedCustomerEmail(email, firstName, details, adminResponse) {
  const { booking_reference, event_date } = details;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #C8922A;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #C8922A; color: #F5F0E8; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Venue Setup Changes Requested</span>
        </div>
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Venue Setup Request Update</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          We reviewed your venue setup request for booking <strong>${booking_reference || ""}</strong> (Event Date: <strong>${formattedDate}</strong>) and would like to request some changes.
        </p>
        ${adminResponse ? `
        <div style="background-color: #FFF8F0; border-left: 4px solid #C8922A; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="font-size: 13px; color: #2C1810; margin: 0;"><strong>Admin Response:</strong> ${adminResponse}</p>
        </div>` : ""}
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Please log in to your dashboard to review and update your venue setup request.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Venue Setup Update: Changes Requested (${booking_reference || "Authentic Flavors"})`, html);
}

export async function sendVenueSetupDeclinedCustomerEmail(email, firstName, details, adminResponse) {
  const { booking_reference, event_date } = details;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">by Chef Ramos</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #C4541A;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #C4541A; color: #F5F0E8; padding: 4px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase;">Venue Setup Declined</span>
        </div>
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">Venue Setup Request Update</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello${firstName ? ` ${escapeHtml(firstName)}` : ""},
        </p>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Your venue setup request for booking <strong>${booking_reference || ""}</strong> (Event Date: <strong>${formattedDate}</strong>) could not be accommodated.
        </p>
        ${adminResponse ? `
        <div style="background-color: #FFF5F2; border-left: 4px solid #C4541A; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="font-size: 13px; color: #2C1810; margin: 0;"><strong>Reason:</strong> ${adminResponse}</p>
        </div>` : ""}
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Go to Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(email, `Venue Setup Update: Request Declined (${booking_reference || "Authentic Flavors"})`, html);
}

export async function sendNewBookingAdminEmail(adminEmail, details) {
  const { booking_reference, customer_name, event_date, guest_count, total_price } = details;
  const formattedDate = formatPhilippineDate(event_date);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">Admin Portal</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">New Booking Received</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Customer <strong>${escapeHtml(customer_name)}</strong> submitted a new booking request
          <strong>${escapeHtml(booking_reference || "")}</strong> that is awaiting your review.
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 14px; color: #2C1810;">
            <tr><td style="padding: 4px 0;">Booking Ref:</td><td style="font-weight: bold; text-align: right;">${escapeHtml(booking_reference || "")}</td></tr>
            <tr><td style="padding: 4px 0;">Event Date:</td><td style="font-weight: bold; text-align: right;">${formattedDate}</td></tr>
            <tr><td style="padding: 4px 0;">Guests:</td><td style="font-weight: bold; text-align: right;">${guest_count}</td></tr>
            <tr><td style="padding: 4px 0;">Price:</td><td style="font-weight: bold; text-align: right;">&#8369;${Number(total_price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
          </table>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          Please log into the Admin Dashboard to review and approve or reject this booking.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/admin" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Review Booking in Admin Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(adminEmail, `New Booking Request: ${booking_reference || "Authentic Flavors"}`, html);
}

export async function sendNewFeedbackAdminEmail(adminEmail, details) {
  const { booking_reference, customer_name, rating, package_name } = details;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #F5F0E8; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-family: 'Georgia', serif; color: #2C1810; font-size: 22px; margin: 0;">Authentic Flavors</h1>
        <p style="color: #C8922A; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0;">Admin Portal</p>
      </div>
      <div style="background-color: #ffffff; border-radius: 12px; padding: 24px;">
        <h2 style="color: #2C1810; font-size: 18px; margin: 0 0 12px;">New Customer Feedback</h2>
        <p style="color: #2C1810; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Customer <strong>${escapeHtml(customer_name)}</strong> rated their
          <strong>${escapeHtml(package_name || "catering event")}</strong> experience
          (booking ${escapeHtml(booking_reference || "")}) with ${Number(rating)} out of 5 stars.
        </p>
        <div style="background-color: #F5F0E8; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
          <span style="font-size: 28px; font-weight: bold; color: #C4541A;">${Number(rating)}/5</span>
        </div>
        <p style="color: #2C1810; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
          View the full feedback and AI analysis in the Admin Dashboard.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${env.frontendUrl}/admin" style="display: inline-block; background: linear-gradient(135deg, #C8922A, #C4541A); color: #F5F0E8; text-decoration: none; padding: 12px 32px; border-radius: 24px; font-size: 14px; font-weight: bold;">
            Open Admin Dashboard
          </a>
        </div>
      </div>
      <p style="text-align: center; color: #2C1810; font-size: 11px; margin-top: 16px;">
        &copy; ${new Date().getFullYear()} Authentic Flavors by Chef Ramos. All rights reserved.
      </p>
    </div>
  `;

  return sendBrevoEmail(adminEmail, `New Feedback Received: ${Number(rating)} Stars (${booking_reference || "Authentic Flavors"})`, html);
}


