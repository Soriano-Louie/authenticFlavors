import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool } from "../db/pool.js";
import { env, isProduction } from "../config/env.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import {
  validateLoginInput,
  validateRegisterInput,
  validateProfileUpdateInput,
} from "../utils/validators.js";
import {
  sendVerificationCode,
  sendPasswordResetEmail,
  sendEmailChangeVerificationEmail,
} from "../services/emailService.js";
import {
  generateVerificationCode,
  generateResetToken,
  hashResetToken,
  hashVerificationCode,
} from "../utils/tokens.js";
import { logActivity } from "../services/activityService.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../services/cloudinaryService.js";

// Package Controller Functions
export async function getPackages(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM packages WHERE status = 'Active' ORDER BY package_name",
    );
    res.status(200).json({ packages: rows });
  } catch (error) {
    console.error("Error fetching packages:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch packages" },
    });
  }
}

export async function getPackageById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM packages WHERE package_id = ? AND status = 'Active'",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Package not found" },
      });
    }

    res.status(200).json({ package: rows[0] });
  } catch (error) {
    console.error("Error fetching package:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch package" },
    });
  }
}

export async function getMenuCategories(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM menu_categories WHERE status = 'Active' ORDER BY display_order, category_name",
    );
    res.status(200).json({ categories: rows });
  } catch (error) {
    console.error("Error fetching menu categories:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch menu categories",
      },
    });
  }
}

export async function getMenuItems(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT mi.*, mc.category_name 
       FROM menu_items mi 
       JOIN menu_categories mc ON mi.category_id = mc.category_id 
       WHERE mi.availability_status = 'Active' AND mc.status = 'Active'
       ORDER BY mc.display_order, mc.category_name, mi.item_name`,
    );
    res.status(200).json({ items: rows });
  } catch (error) {
    console.error("Error fetching menu items:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch menu items" },
    });
  }
}

export async function getMenuItemsByCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM menu_items WHERE category_id = ? AND availability_status = 'Active' ORDER BY item_name",
      [categoryId],
    );
    res.status(200).json({ items: rows });
  } catch (error) {
    console.error("Error fetching menu items by category:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch menu items" },
    });
  }
}

export async function getEventTypes(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM event_types WHERE status = 'Active' ORDER BY type_name",
    );
    res.status(200).json({ eventTypes: rows });
  } catch (error) {
    console.error("Error fetching event types:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to fetch event types" },
    });
  }
}

export async function getVenueSetups(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM venue_setups WHERE status = 'Active' ORDER BY setup_name",
    );
    res.status(200).json({ venueSetups: rows });
  } catch (error) {
    console.error("Error fetching venue setups:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch venue setups",
      },
    });
  }
}

function cookieConfig(req) {
  const origin = req.headers.origin;
  const isCrossOrigin =
    Boolean(origin) && new URL(origin).host !== req.headers.host;
  const secure = isProduction || isCrossOrigin;

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function normalizeUserRow(row) {
  return {
    user_id: row.user_id,
    first_name: row.first_name,
    middle_name: row.middle_name,
    last_name: row.last_name,
    email: row.email,
    phone_number: row.phone_number,
    role: row.role,
    account_status: row.account_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    dietary_preferences: row.dietary_preferences ?? null,
    profile_photo_url: row.profile_photo_url ?? null,
    profile_photo_public_id: row.profile_photo_public_id ?? null,
  };
}

function issueTokens(user) {
  const payload = {
    sub: String(user.user_id),
    role: user.role,
    email: user.email,
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function register(req, res) {
  const parsed = validateRegisterInput(req.body);

  if (!parsed.isValid) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please fix the highlighted fields.",
        fieldErrors: parsed.fieldErrors,
      },
    });
  }

  const { first_name, middle_name, last_name, email, phone_number, password } =
    parsed.data;

  const [existing] = await pool.query(
    "SELECT user_id FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  if (existing.length > 0) {
    return res.status(409).json({
      error: {
        code: "EMAIL_IN_USE",
        message: "Email is already registered.",
        fieldErrors: { email: "Email is already registered." },
      },
    });
  }

  const password_hash = await bcrypt.hash(password, 12);

  // Create user with Pending status — will be activated after email verification
  const [result] = await pool.query(
    `
      INSERT INTO users (
        first_name,
        middle_name,
        last_name,
        email,
        phone_number,
        password_hash,
        role,
        account_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'Customer', 'Pending')
    `,
    [first_name, middle_name, last_name, email, phone_number, password_hash],
  );

  // Generate and store verification code
  const code = generateVerificationCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

  logActivity({
    actorUserId: result.insertId,
    actorRole: "Customer",
    activityType: "user_registered",
    action: "created a new customer account",
  }).catch((err) =>
    console.error("Activity logging failed (user_registered):", err),
  );

  // Invalidate any previous codes for this email
  await pool.query(
    "UPDATE email_verifications SET is_used = TRUE WHERE email = ? AND is_used = FALSE",
    [email],
  );

  await pool.query(
    "INSERT INTO email_verifications (email, code, expires_at, resend_at) VALUES (?, ?, ?, ?)",
    [email, code, expiresAt, now],
  );

  // Send the code via email
  try {
    await sendVerificationCode(email, code);
  } catch (error) {
    console.error("Failed to send verification email:", error);
    // Still return success — user can request resend
  }

  return res.status(201).json({
    message:
      "Account created. Please check your email for the verification code.",
    email,
  });
}

export async function sendVerification(req, res) {
  const email = String(req.body.email ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Email is required." },
    });
  }

  // Check if email is already registered and not yet verified
  const [users] = await pool.query(
    "SELECT user_id, account_status FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  if (users.length === 0) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "No pending registration found for this email.",
      },
    });
  }

  if (users[0].account_status === "Active") {
    return res.status(400).json({
      error: {
        code: "ALREADY_VERIFIED",
        message: "This email is already verified.",
      },
    });
  }

  // Check resend cooldown
  const [existingCodes] = await pool.query(
    "SELECT resend_at FROM email_verifications WHERE email = ? ORDER BY id DESC LIMIT 1",
    [email],
  );

  if (existingCodes.length > 0 && existingCodes[0].resend_at) {
    const lastResend = new Date(existingCodes[0].resend_at).getTime();
    const cooldown = 60 * 1000; // 60 seconds
    if (Date.now() - lastResend < cooldown) {
      const remaining = Math.ceil(
        (cooldown - (Date.now() - lastResend)) / 1000,
      );
      return res.status(429).json({
        error: {
          code: "RESEND_COOLDOWN",
          message: `Please wait ${remaining} seconds before requesting a new code.`,
        },
      });
    }
  }

  // Generate new code, invalidate old ones
  const code = generateVerificationCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  await pool.query(
    "UPDATE email_verifications SET is_used = TRUE WHERE email = ? AND is_used = FALSE",
    [email],
  );

  await pool.query(
    "INSERT INTO email_verifications (email, code, expires_at, resend_at) VALUES (?, ?, ?, ?)",
    [email, code, expiresAt, now],
  );

  try {
    await sendVerificationCode(email, code);
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return res.status(500).json({
      error: {
        code: "EMAIL_FAILED",
        message: "Failed to send verification email. Please try again later.",
      },
    });
  }

  return res.status(200).json({ message: "Verification code sent." });
}

export async function verifyEmail(req, res) {
  const email = String(req.body.email ?? "")
    .trim()
    .toLowerCase();
  const code = String(req.body.code ?? "").trim();

  if (!email || !code) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Email and verification code are required.",
      },
    });
  }

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Verification code must be a 6-digit number.",
      },
    });
  }

  // Find the latest unused code for this email
  const [codes] = await pool.query(
    "SELECT * FROM email_verifications WHERE email = ? AND is_used = FALSE ORDER BY id DESC LIMIT 1",
    [email],
  );

  if (codes.length === 0) {
    return res.status(400).json({
      error: {
        code: "NO_CODE",
        message: "No verification code found. Please request a new one.",
      },
    });
  }

  const verification = codes[0];

  // Check expiration
  if (new Date(verification.expires_at) < new Date()) {
    return res.status(400).json({
      error: {
        code: "CODE_EXPIRED",
        message: "Verification code has expired. Please request a new one.",
      },
    });
  }

  // Check attempt count (max 5 attempts)
  if (verification.attempt_count >= 5) {
    return res.status(429).json({
      error: {
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many verification attempts. Please request a new code.",
      },
    });
  }

  // Increment attempt count
  await pool.query(
    "UPDATE email_verifications SET attempt_count = attempt_count + 1 WHERE id = ?",
    [verification.id],
  );

  // Verify code
  if (verification.code !== code) {
    return res.status(400).json({
      error: {
        code: "INVALID_CODE",
        message: "Invalid verification code. Please try again.",
      },
    });
  }

  // Mark code as used
  await pool.query(
    "UPDATE email_verifications SET is_used = TRUE WHERE id = ?",
    [verification.id],
  );

  // Activate the user account
  await pool.query(
    "UPDATE users SET account_status = 'Active' WHERE email = ?",
    [email],
  );

  // Fetch the user and issue tokens
  const [rows] = await pool.query(
    "SELECT user_id, first_name, middle_name, last_name, email, phone_number, role, account_status, created_at, updated_at, dietary_preferences, profile_photo_url, profile_photo_public_id FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  if (rows.length === 0) {
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Account not found after verification.",
      },
    });
  }

  const user = normalizeUserRow(rows[0]);
  const { accessToken, refreshToken } = issueTokens(user);

  res.cookie(env.refreshCookieName, refreshToken, cookieConfig(req));

  return res
    .status(200)
    .json({ user, accessToken, message: "Email verified successfully!" });
}

export async function login(req, res) {
  const parsed = validateLoginInput(req.body);

  if (!parsed.isValid) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please provide email and password.",
        fieldErrors: parsed.fieldErrors,
      },
    });
  }

  const { email, password } = parsed.data;

  const [rows] = await pool.query(
    "SELECT user_id, first_name, middle_name, last_name, email, phone_number, password_hash, role, account_status, created_at, updated_at, dietary_preferences, profile_photo_url, profile_photo_public_id FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  if (rows.length === 0) {
    return res.status(401).json({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      },
    });
  }

  const userRow = rows[0];
  const passwordMatches = await bcrypt.compare(password, userRow.password_hash);

  if (!passwordMatches) {
    return res.status(401).json({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      },
    });
  }

  if (userRow.account_status !== "Active") {
    if (userRow.account_status === "Pending") {
      return res.status(403).json({
        error: {
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email before signing in.",
          email,
        },
      });
    }
    return res.status(403).json({
      error: {
        code: "ACCOUNT_DISABLED",
        message: "This account is not active. Please contact support.",
      },
    });
  }

  const user = normalizeUserRow(userRow);
  const { accessToken, refreshToken } = issueTokens(user);

  res.cookie(env.refreshCookieName, refreshToken, cookieConfig(req));

  return res.status(200).json({ user, accessToken });
}

export async function forgotPassword(req, res) {
  const email = String(req.body.email ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Email is required." },
    });
  }

  // Always return the same generic message to prevent user enumeration
  const genericMessage =
    "If an account with that email exists, a password reset link has been sent.";

  try {
    const [users] = await pool.query(
      "SELECT user_id, first_name, account_status FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    if (users.length === 0 || users[0].account_status !== "Active") {
      return res.status(200).json({ message: genericMessage });
    }

    const user = users[0];

    // Invalidate any existing reset tokens for this user
    await pool.query(
      "UPDATE password_reset_tokens SET is_used = TRUE WHERE user_id = ? AND is_used = FALSE",
      [user.user_id],
    );

    // Generate new token
    const { raw, hash } = generateResetToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
      [user.user_id, hash, expiresAt],
    );

    // Send email
    await sendPasswordResetEmail(email, user.first_name, raw);
  } catch (error) {
    // Log but don't expose whether the email exists
    console.error("Error in forgot-password flow:", error);
  }

  return res.status(200).json({ message: genericMessage });
}

export async function resetPassword(req, res) {
  const token = String(req.body.token ?? "").trim();
  const password = String(req.body.password ?? "");

  if (!token) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Reset token is required." },
    });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Password must be at least 8 characters.",
      },
    });
  }

  const tokenHash = hashResetToken(token);

  // Find the token
  const [tokens] = await pool.query(
    "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND is_used = FALSE LIMIT 1",
    [tokenHash],
  );

  if (tokens.length === 0) {
    return res.status(400).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or already used reset link.",
      },
    });
  }

  const resetRecord = tokens[0];

  // Check expiration
  if (new Date(resetRecord.expires_at) < new Date()) {
    return res.status(400).json({
      error: {
        code: "TOKEN_EXPIRED",
        message: "Reset link has expired. Please request a new one.",
      },
    });
  }

  // Hash the new password and update
  const password_hash = await bcrypt.hash(password, 12);

  await pool.query("UPDATE users SET password_hash = ? WHERE user_id = ?", [
    password_hash,
    resetRecord.user_id,
  ]);

  // Mark the token as used
  await pool.query(
    "UPDATE password_reset_tokens SET is_used = TRUE WHERE id = ?",
    [resetRecord.id],
  );

  return res.status(200).json({
    message: "Password has been reset successfully. You can now sign in.",
  });
}

export async function me(req, res) {
  const userId = Number(req.auth.sub);

  const [rows] = await pool.query(
    "SELECT user_id, first_name, middle_name, last_name, email, phone_number, role, account_status, created_at, updated_at, dietary_preferences, profile_photo_url, profile_photo_public_id FROM users WHERE user_id = ? LIMIT 1",
    [userId],
  );

  if (rows.length === 0) {
    return res
      .status(401)
      .json({ error: { code: "UNAUTHORIZED", message: "User not found." } });
  }

  if (rows[0].account_status !== "Active") {
    return res.status(403).json({
      error: {
        code: "ACCOUNT_DISABLED",
        message: "This account is not active.",
      },
    });
  }

  return res.status(200).json({ user: normalizeUserRow(rows[0]) });
}

export async function refresh(req, res) {
  const refreshToken = req.cookies?.[env.refreshCookieName];

  if (!refreshToken) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Missing refresh token." },
    });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const userId = Number(decoded.sub);

    const [rows] = await pool.query(
      "SELECT user_id, first_name, middle_name, last_name, email, phone_number, role, account_status, created_at, updated_at, dietary_preferences, profile_photo_url, profile_photo_public_id FROM users WHERE user_id = ? LIMIT 1",
      [userId],
    );

    if (rows.length === 0 || rows[0].account_status !== "Active") {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Session is no longer valid.",
        },
      });
    }

    const user = normalizeUserRow(rows[0]);
    const { accessToken, refreshToken: nextRefreshToken } = issueTokens(user);

    res.cookie(env.refreshCookieName, nextRefreshToken, cookieConfig(req));

    return res.status(200).json({ user, accessToken });
  } catch {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid refresh token." },
    });
  }
}

export function logout(req, res) {
  res.clearCookie(env.refreshCookieName, cookieConfig(req));
  return res.status(200).json({ message: "Logged out successfully." });
}

export async function updateProfile(req, res) {
  const userId = Number(req.auth.sub);
  const parsed = validateProfileUpdateInput(req.body);

  if (!parsed.isValid) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please fix the highlighted fields.",
        fieldErrors: parsed.fieldErrors,
      },
    });
  }

  const {
    first_name,
    middle_name,
    last_name,
    phone_number,
    dietary_preferences,
  } = parsed.data;

  // NOTE: email is intentionally NOT updated here. Changing an email address
  // requires going through the verified email-change flow
  // (POST /api/auth/change-email/request + /verify) so the new address is
  // confirmed via a one-time code before it is saved.

  // Update user profile
  await pool.query(
    `
      UPDATE users 
      SET first_name = ?, middle_name = ?, last_name = ?, phone_number = ?, dietary_preferences = ?
      WHERE user_id = ?
    `,
    [
      first_name,
      middle_name,
      last_name,
      phone_number,
      dietary_preferences,
      userId,
    ],
  );

  // Fetch updated user data
  const [rows] = await pool.query(
    "SELECT user_id, first_name, middle_name, last_name, email, phone_number, role, account_status, created_at, updated_at, dietary_preferences, profile_photo_url, profile_photo_public_id FROM users WHERE user_id = ? LIMIT 1",
    [userId],
  );

  if (rows.length === 0) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "User not found." },
    });
  }

  const user = normalizeUserRow(rows[0]);
  return res.status(200).json({ user });
}

// ═════════════════════════════════════════════════════════════════════════════
// Verified Email Change
// ═════════════════════════════════════════════════════════════════════════════
// Flow: current email → user enters new email → code sent to NEW email →
// user enters code → code validated → new email saved. The email is NEVER
// changed until the code has been successfully verified.

const EMAIL_CHANGE_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_CHANGE_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends
const EMAIL_CHANGE_MAX_ATTEMPTS = 5;

export async function requestEmailChange(req, res) {
  const userId = Number(req.auth.sub);
  const newEmail = String(req.body.new_email ?? "").trim().toLowerCase();

  if (!newEmail) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "New email is required.",
        fieldErrors: { new_email: "New email is required." },
      },
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "New email is invalid.",
        fieldErrors: { new_email: "New email is invalid." },
      },
    });
  }

  try {
    // Load current user
    const [users] = await pool.query(
      "SELECT email FROM users WHERE user_id = ? LIMIT 1",
      [userId],
    );
    if (users.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found." },
      });
    }
    const currentEmail = users[0].email;

    // The new email must differ from the current one
    if (newEmail === currentEmail.toLowerCase()) {
      return res.status(400).json({
        error: {
          code: "SAME_EMAIL",
          message: "New email must be different from your current email.",
          fieldErrors: { new_email: "New email is different from your current email." },
        },
      });
    }

    // The new email must not already belong to another account
    const [existing] = await pool.query(
      "SELECT user_id FROM users WHERE email = ? AND user_id != ? LIMIT 1",
      [newEmail, userId],
    );
    if (existing.length > 0) {
      return res.status(409).json({
        error: {
          code: "EMAIL_IN_USE",
          message: "Email is already registered to another account.",
          fieldErrors: { new_email: "Email is already registered." },
        },
      });
    }

    // Cooldown between resend requests
    const [recent] = await pool.query(
      `SELECT resend_at FROM email_change_verifications
       WHERE user_id = ? AND new_email = ? AND is_used = FALSE
       ORDER BY id DESC LIMIT 1`,
      [userId, newEmail],
    );
    if (recent.length > 0 && recent[0].resend_at) {
      const lastResend = new Date(recent[0].resend_at).getTime();
      if (Date.now() - lastResend < EMAIL_CHANGE_COOLDOWN_MS) {
        const remaining = Math.ceil(
          (EMAIL_CHANGE_COOLDOWN_MS - (Date.now() - lastResend)) / 1000,
        );
        return res.status(429).json({
          error: {
            code: "RESEND_COOLDOWN",
            message: `Please wait ${remaining} seconds before requesting a new code.`,
          },
        });
      }
    }

    // Invalidate any previously unused codes for this user + new email
    await pool.query(
      `UPDATE email_change_verifications SET is_used = TRUE
       WHERE user_id = ? AND new_email = ? AND is_used = FALSE`,
      [userId, newEmail],
    );

    // Generate a secure code and store only its hash
    const code = generateVerificationCode();
    const now = new Date();
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_CODE_TTL_MS);

    const [insertResult] = await pool.query(
      `INSERT INTO email_change_verifications
         (user_id, current_email, new_email, code_hash, expires_at, resend_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        currentEmail,
        newEmail,
        hashVerificationCode(code),
        expiresAt,
        now,
      ],
    );
    const verificationId = insertResult.insertId;

    try {
      await sendEmailChangeVerificationEmail(newEmail, code);
    } catch (error) {
      // Roll back the pending code so the user can retry cleanly
      console.error("Failed to send email change verification:", error);
      await pool.query(
        "DELETE FROM email_change_verifications WHERE id = ?",
        [verificationId],
      );
      return res.status(500).json({
        error: {
          code: "EMAIL_FAILED",
          message: "Failed to send verification email. Please try again later.",
        },
      });
    }

    return res.status(200).json({
      message: `A verification code has been sent to ${newEmail}.`,
    });
  } catch (error) {
    console.error("requestEmailChange failed:", error);
    return res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to request email change. Please try again.",
      },
    });
  }
}

export async function verifyEmailChange(req, res) {
  const userId = Number(req.auth.sub);
  const newEmail = String(req.body.new_email ?? "").trim().toLowerCase();
  const code = String(req.body.code ?? "").trim();

  if (!newEmail || !code) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "New email and verification code are required.",
      },
    });
  }

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Verification code must be a 6-digit number.",
      },
    });
  }

  try {
    // Find the latest unused code for this user + new email
    const [codes] = await pool.query(
      `SELECT * FROM email_change_verifications
       WHERE user_id = ? AND new_email = ? AND is_used = FALSE
       ORDER BY id DESC LIMIT 1`,
      [userId, newEmail],
    );

    if (codes.length === 0) {
      return res.status(400).json({
        error: {
          code: "NO_CODE",
          message: "No verification code found. Please request a new one.",
        },
      });
    }

    const verification = codes[0];

    // Check expiration
    if (new Date(verification.expires_at) < new Date()) {
      return res.status(400).json({
        error: {
          code: "CODE_EXPIRED",
          message: "Verification code has expired. Please request a new one.",
        },
      });
    }

    // Limit repeated attempts
    if (verification.attempt_count >= EMAIL_CHANGE_MAX_ATTEMPTS) {
      return res.status(429).json({
        error: {
          code: "TOO_MANY_ATTEMPTS",
          message: "Too many verification attempts. Please request a new code.",
        },
      });
    }

    // Increment attempt count before verifying
    await pool.query(
      "UPDATE email_change_verifications SET attempt_count = attempt_count + 1 WHERE id = ?",
      [verification.id],
    );

    // Compare against the stored hash (constant-time via crypto.timingSafeEqual)
    const storedHash = Buffer.from(verification.code_hash, "hex");
    const providedHash = Buffer.from(hashVerificationCode(code), "hex");
    const codeMatches =
      storedHash.length === providedHash.length &&
      crypto.timingSafeEqual(storedHash, providedHash);

    if (!codeMatches) {
      return res.status(400).json({
        error: {
          code: "INVALID_CODE",
          message: "Invalid verification code. Please try again.",
        },
      });
    }

    // Mark this code as used
    await pool.query(
      "UPDATE email_change_verifications SET is_used = TRUE WHERE id = ?",
      [verification.id],
    );

    // Invalidate any other unused codes for this user + new email
    await pool.query(
      `UPDATE email_change_verifications SET is_used = TRUE
       WHERE user_id = ? AND new_email = ? AND is_used = FALSE`,
      [userId, newEmail],
    );

    // Now save the new email (only after successful verification)
    await pool.query("UPDATE users SET email = ? WHERE user_id = ?", [
      newEmail,
      userId,
    ]);

    // Fetch the updated user
    const [rows] = await pool.query(
      "SELECT user_id, first_name, middle_name, last_name, email, phone_number, role, account_status, created_at, updated_at, dietary_preferences, profile_photo_url, profile_photo_public_id FROM users WHERE user_id = ? LIMIT 1",
      [userId],
    );

    if (rows.length === 0) {
      return res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Account not found after email change.",
        },
      });
    }

    const user = normalizeUserRow(rows[0]);

    await logActivity({
      actorUserId: userId,
      actorRole: "Customer",
      activityType: "email_changed",
      action: `changed their account email`,
    });

    return res.status(200).json({
      user,
      message: "Email changed successfully!",
    });
  } catch (error) {
    console.error("verifyEmailChange failed:", error);
    return res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to change email. Please try again.",
      },
    });
  }
}

export async function uploadProfilePhoto(req, res) {
  const userId = Number(req.auth.sub);

  if (!req.file) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Profile photo image file is required.",
      },
    });
  }

  try {
    // Fetch current user to get existing photo public_id for cleanup
    const [users] = await pool.query(
      "SELECT user_id, profile_photo_public_id FROM users WHERE user_id = ? LIMIT 1",
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found." },
      });
    }

    const currentUser = users[0];

    // Upload new photo to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, "profile_photos");

    // Delete old photo from Cloudinary if it exists
    if (currentUser.profile_photo_public_id) {
      await deleteFromCloudinary(currentUser.profile_photo_public_id);
    }

    // Update user record with new photo
    await pool.query(
      "UPDATE users SET profile_photo_url = ?, profile_photo_public_id = ? WHERE user_id = ?",
      [result.secure_url, result.public_id, userId],
    );

    // Fetch updated user data
    const [rows] = await pool.query(
      "SELECT user_id, first_name, middle_name, last_name, email, phone_number, role, account_status, created_at, updated_at, dietary_preferences, profile_photo_url, profile_photo_public_id FROM users WHERE user_id = ? LIMIT 1",
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found." },
      });
    }

    const user = normalizeUserRow(rows[0]);
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Upload profile photo failed:", error);
    return res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to upload profile photo. Please try again.",
      },
    });
  }
}
