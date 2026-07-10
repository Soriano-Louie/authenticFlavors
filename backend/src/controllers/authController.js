import bcrypt from "bcryptjs";
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

function cookieConfig() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
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

  const {
    first_name,
    middle_name,
    last_name,
    email,
    phone_number,
    password,
  } = parsed.data;

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
      ) VALUES (?, ?, ?, ?, ?, ?, 'Customer', 'Active')
    `,
    [
      first_name,
      middle_name,
      last_name,
      email,
      phone_number,
      password_hash,
    ],
  );

  const [rows] = await pool.query(
    "SELECT user_id, first_name, middle_name, last_name, email, phone_number, role, account_status, created_at, updated_at FROM users WHERE user_id = ? LIMIT 1",
    [result.insertId],
  );

  const user = normalizeUserRow(rows[0]);
  const { accessToken, refreshToken } = issueTokens(user);

  res.cookie(env.refreshCookieName, refreshToken, cookieConfig());

  return res.status(201).json({ user, accessToken });
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
    "SELECT user_id, first_name, middle_name, last_name, email, phone_number, password_hash, role, account_status, created_at, updated_at FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  if (rows.length === 0) {
    return res.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
    });
  }

  const userRow = rows[0];
  const passwordMatches = await bcrypt.compare(password, userRow.password_hash);

  if (!passwordMatches) {
    return res.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
    });
  }

  if (userRow.account_status !== "Active") {
    return res.status(403).json({
      error: {
        code: "ACCOUNT_DISABLED",
        message: "This account is not active. Please contact support.",
      },
    });
  }

  const user = normalizeUserRow(userRow);
  const { accessToken, refreshToken } = issueTokens(user);

  res.cookie(env.refreshCookieName, refreshToken, cookieConfig());

  return res.status(200).json({ user, accessToken });
}

export async function me(req, res) {
  const userId = Number(req.auth.sub);

  const [rows] = await pool.query(
    "SELECT user_id, first_name, middle_name, last_name, email, phone_number, role, account_status, created_at, updated_at FROM users WHERE user_id = ? LIMIT 1",
    [userId],
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "User not found." } });
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
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing refresh token." } });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const userId = Number(decoded.sub);

    const [rows] = await pool.query(
      "SELECT user_id, first_name, middle_name, last_name, email, phone_number, role, account_status, created_at, updated_at FROM users WHERE user_id = ? LIMIT 1",
      [userId],
    );

    if (rows.length === 0 || rows[0].account_status !== "Active") {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Session is no longer valid." } });
    }

    const user = normalizeUserRow(rows[0]);
    const { accessToken, refreshToken: nextRefreshToken } = issueTokens(user);

    res.cookie(env.refreshCookieName, nextRefreshToken, cookieConfig());

    return res.status(200).json({ user, accessToken });
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid refresh token." } });
  }
}

export function logout(_req, res) {
  res.clearCookie(env.refreshCookieName, cookieConfig());
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

  const { first_name, middle_name, last_name, email, phone_number } = parsed.data;

  // Check if email is already taken by another user
  const [existing] = await pool.query(
    "SELECT user_id FROM users WHERE email = ? AND user_id != ? LIMIT 1",
    [email, userId],
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

  // Update user profile
  await pool.query(
    `
      UPDATE users 
      SET first_name = ?, middle_name = ?, last_name = ?, email = ?, phone_number = ?
      WHERE user_id = ?
    `,
    [first_name, middle_name, last_name, email, phone_number, userId],
  );

  // Fetch updated user data
  const [rows] = await pool.query(
    "SELECT user_id, first_name, middle_name, last_name, email, phone_number, role, account_status, created_at, updated_at FROM users WHERE user_id = ? LIMIT 1",
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
