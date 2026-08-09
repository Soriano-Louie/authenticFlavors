import crypto from "crypto";

/**
 * Generate a secure 6-digit verification code.
 */
export function generateVerificationCode() {
  return String(crypto.randomInt(100000, 999999));
}

/**
 * Generate a cryptographically secure password reset token.
 * Returns the raw token (to send in email) and its SHA-256 hash (to store in DB).
 */
export function generateResetToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

/**
 * Hash a raw reset token for DB lookup.
 */
export function hashResetToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Hash a verification code (SHA-256) so codes are never stored in plain text.
 */
export function hashVerificationCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}
