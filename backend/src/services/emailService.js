import { env } from "../config/env.js";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function buildSender() {
  return {
    email: env.senderEmail,
    name: env.senderName,
  };
}

async function sendBrevoEmail(to, subject, htmlContent) {
  const response = await fetch(BREVO_API_URL, {
    method: "POST",
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
          Hello${firstName ? ` ${firstName}` : ""},
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
  const formattedDate = new Date(due_date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
          Hello${firstName ? ` ${firstName}` : ""},
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
  const formattedDate = new Date(due_date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
          Hello${firstName ? ` ${firstName}` : ""},
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
          Hello${firstName ? ` ${firstName}` : ""},
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
