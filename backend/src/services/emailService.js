import { env } from "../config/env.js";

// Sender email must be verified in Brevo dashboard (Settings → Senders)
// Defaults to SMTP_USER, but you can override with BREVO_SENDER_EMAIL env var
const SENDER_EMAIL =
  env.brevoSenderEmail ||
  (env.smtpUser.includes("@") ? env.smtpUser : "noreply@authenticflavors.ph");

/**
 * Helper to send email via Brevo REST API (HTTPS port 443, avoids SMTP timeout blocks).
 * Uses the SMTP key as the Brevo API key.
 */
async function sendBrevoEmail({ to, subject, html }) {
  const apiKey = env.smtpPass;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: "Authentic Flavors by Chef Ramos",
        email: SENDER_EMAIL,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Brevo API Error (${response.status}): ${errorData.message || response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Send a 6-digit email verification code.
 */
export async function sendVerificationCode(email, code) {
  await sendBrevoEmail({
    to: email,
    subject: "Verify Your Email – Authentic Flavors by Chef Ramos",
    html: `
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
    `,
  });
}

/**
 * Send a password reset email with a secure link.
 */
export async function sendPasswordResetEmail(email, firstName, resetToken) {
  const resetUrl = `${env.frontendUrl}/reset-password?token=${resetToken}`;

  await sendBrevoEmail({
    to: email,
    subject: "Reset Your Password – Authentic Flavors by Chef Ramos",
    html: `
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
    `,
  });
}
