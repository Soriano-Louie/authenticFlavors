import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import { logActivity } from "../services/activityService.js";
import {
  getInvalidNameReason,
  getPasswordError,
  isEmailFormatValid,
  isPasswordStrongEnough,
  validatePhone,
} from "../utils/registrationValidation.js";
import {
  normalizeEmail,
  normalizePhone,
} from "../utils/validators.js";

const VALID_ROLES = ["Admin", "Customer"];
const VALID_STATUSES = ["Active", "Inactive", "Suspended", "Pending"];

/**
 * Fetch list of users for admin with search, filter, and pagination.
 */
export async function getAdminUsers(req, res) {
  try {
    const { role, status, search } = req.query;

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      200,
    );
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;

    const whereClauses = [];
    const params = [];

    if (role && role !== "All") {
      if (VALID_ROLES.includes(role)) {
        whereClauses.push("u.role = ?");
        params.push(role);
      } else {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid role filter: ${role}`,
          },
        });
      }
    }

    if (status && status !== "All") {
      if (VALID_STATUSES.includes(status)) {
        whereClauses.push("u.account_status = ?");
        params.push(status);
      } else {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid status filter: ${status}`,
          },
        });
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const like = `%${q}%`;
      whereClauses.push(`(
        u.first_name LIKE ? OR
        u.middle_name LIKE ? OR
        u.last_name LIKE ? OR
        CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR
        u.email LIKE ? OR
        u.phone_number LIKE ? OR
        CAST(u.user_id AS CHAR) LIKE ?
      )`);
      params.push(like, like, like, like, like, like, like);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Count total matching users
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
      params,
    );
    const total = countRow?.total ?? 0;

    // Fetch user rows with total bookings count
    const [rows] = await pool.query(
      `SELECT 
        u.user_id,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.email,
        u.phone_number,
        u.role,
        u.account_status,
        u.profile_photo_url,
        u.created_at,
        u.updated_at,
        COUNT(b.booking_id) AS total_bookings
       FROM users u
       LEFT JOIN bookings b ON u.user_id = b.user_id
       ${whereSql}
       GROUP BY u.user_id
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    // Summary statistics for dashboard cards
    const [[statsRow]] = await pool.query(`
      SELECT 
        COUNT(*) AS total_users,
        COUNT(CASE WHEN account_status = 'Active' THEN 1 END) AS active_users,
        COUNT(CASE WHEN account_status IN ('Inactive', 'Suspended') THEN 1 END) AS inactive_users,
        COUNT(CASE WHEN account_status = 'Pending' THEN 1 END) AS pending_users,
        COUNT(CASE WHEN role = 'Admin' THEN 1 END) AS admin_users,
        COUNT(CASE WHEN role = 'Customer' THEN 1 END) AS customer_users
      FROM users
    `);

    const users = rows.map((r) => ({
      user_id: r.user_id,
      first_name: r.first_name,
      middle_name: r.middle_name,
      last_name: r.last_name,
      email: r.email,
      phone_number: r.phone_number,
      role: r.role,
      account_status: r.account_status,
      profile_photo_url: r.profile_photo_url,
      created_at: r.created_at,
      updated_at: r.updated_at,
      total_bookings: Number(r.total_bookings || 0),
    }));

    res.status(200).json({
      users,
      total,
      page,
      limit,
      stats: {
        totalUsers: Number(statsRow?.total_users || 0),
        activeUsers: Number(statsRow?.active_users || 0),
        inactiveUsers: Number(statsRow?.inactive_users || 0),
        pendingUsers: Number(statsRow?.pending_users || 0),
        adminUsers: Number(statsRow?.admin_users || 0),
        customerUsers: Number(statsRow?.customer_users || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching admin users:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch users.",
      },
    });
  }
}

/**
 * Admin create a new user directly.
 */
export async function createAdminUser(req, res) {
  try {
    const fieldErrors = {};

    const firstName = String(req.body.first_name ?? "").trim();
    const middleName = String(req.body.middle_name ?? "").trim();
    const lastName = String(req.body.last_name ?? "").trim();
    const email = normalizeEmail(req.body.email);
    const phoneNumber = normalizePhone(req.body.phone_number);
    const password = String(req.body.password ?? "");
    const role = String(req.body.role ?? "Customer").trim();
    const accountStatus = String(req.body.account_status ?? "Active").trim();

    // Name validation
    const firstNameError = getInvalidNameReason(firstName, "First name");
    if (firstNameError) fieldErrors.first_name = firstNameError;
    const middleNameError = middleName
      ? getInvalidNameReason(middleName, "Middle name")
      : null;
    if (middleNameError) fieldErrors.middle_name = middleNameError;
    const lastNameError = getInvalidNameReason(lastName, "Last name");
    if (lastNameError) fieldErrors.last_name = lastNameError;

    // Email validation
    if (!email) {
      fieldErrors.email = "Email is required.";
    } else if (!isEmailFormatValid(email)) {
      fieldErrors.email = "Enter a valid email address.";
    }

    // Phone validation (optional or normalized)
    let normalizedPhone = null;
    if (phoneNumber) {
      const phoneResult = validatePhone(phoneNumber);
      if (!phoneResult.valid) {
        fieldErrors.phone_number = phoneResult.error;
      } else {
        normalizedPhone = phoneResult.normalized;
      }
    }

    // Password validation
    const passwordError = getPasswordError(password);
    if (passwordError) {
      fieldErrors.password = passwordError;
    } else if (!isPasswordStrongEnough(password)) {
      fieldErrors.password =
        "Password must meet at least 3 of: 8+ characters, uppercase, lowercase, number, special character.";
    }

    // Role & Status validation
    if (!VALID_ROLES.includes(role)) {
      fieldErrors.role = `Role must be one of: ${VALID_ROLES.join(", ")}`;
    }
    if (!VALID_STATUSES.includes(accountStatus)) {
      fieldErrors.account_status = `Status must be one of: ${VALID_STATUSES.join(", ")}`;
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Please fix the highlighted fields.",
          fieldErrors,
        },
      });
    }

    // Check duplicate email
    const [existingEmail] = await pool.query(
      "SELECT user_id FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({
        error: {
          code: "EMAIL_IN_USE",
          message: "Email is already registered to another account.",
          fieldErrors: { email: "Email is already registered." },
        },
      });
    }

    // Check duplicate phone if provided
    if (normalizedPhone) {
      const [existingPhone] = await pool.query(
        "SELECT user_id FROM users WHERE phone_number = ? LIMIT 1",
        [normalizedPhone],
      );
      if (existingPhone.length > 0) {
        return res.status(409).json({
          error: {
            code: "PHONE_IN_USE",
            message: "Phone number is already in use by another account.",
            fieldErrors: { phone_number: "Phone number is already in use." },
          },
        });
      }
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      `INSERT INTO users (
        first_name, middle_name, last_name, email, phone_number,
        password_hash, role, account_status, token_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        firstName,
        middleName || null,
        lastName,
        email,
        normalizedPhone,
        password_hash,
        role,
        accountStatus,
      ],
    );

    const newUserId = result.insertId;

    logActivity({
      actorUserId: Number(req.auth?.sub) || null,
      actorRole: "Admin",
      activityType: "user_created",
      action: `created new ${role} user: ${firstName} ${lastName} (${email})`,
    }).catch((err) => console.error("Activity log failed (user_created):", err));

    res.status(201).json({
      message: "User created successfully.",
      user: {
        user_id: newUserId,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        email,
        phone_number: normalizedPhone,
        role,
        account_status: accountStatus,
        total_bookings: 0,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      const isEmailDup = String(error.sqlMessage ?? "").includes("email");
      return res.status(409).json({
        error: {
          code: isEmailDup ? "EMAIL_IN_USE" : "PHONE_IN_USE",
          message: isEmailDup
            ? "Email is already registered."
            : "Phone number is already registered.",
        },
      });
    }
    console.error("Error creating user:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to create user." },
    });
  }
}

/**
 * Admin update user details (name, email, phone, role, status, optional password).
 */
export async function updateAdminUser(req, res) {
  try {
    const targetUserId = Number(req.params.id);
    const currentAdminId = Number(req.auth?.sub);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid user ID." },
      });
    }

    const [existingUsers] = await pool.query(
      "SELECT * FROM users WHERE user_id = ? LIMIT 1",
      [targetUserId],
    );
    if (existingUsers.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found." },
      });
    }
    const existingUser = existingUsers[0];

    const fieldErrors = {};
    const firstName = String(req.body.first_name ?? existingUser.first_name).trim();
    const middleName =
      req.body.middle_name !== undefined
        ? String(req.body.middle_name ?? "").trim()
        : existingUser.middle_name;
    const lastName = String(req.body.last_name ?? existingUser.last_name).trim();
    const email = normalizeEmail(req.body.email ?? existingUser.email);
    const rawPhone =
      req.body.phone_number !== undefined
        ? normalizePhone(req.body.phone_number)
        : existingUser.phone_number;
    const role = String(req.body.role ?? existingUser.role).trim();
    const accountStatus = String(
      req.body.account_status ?? existingUser.account_status,
    ).trim();
    const newPassword = req.body.password ? String(req.body.password) : null;

    // Safety checks for self-editing
    if (currentAdminId === targetUserId) {
      if (role !== "Admin") {
        return res.status(400).json({
          error: {
            code: "SELF_DEMOTION_PREVENTED",
            message: "You cannot change your own role from Admin.",
          },
        });
      }
      if (accountStatus !== "Active") {
        return res.status(400).json({
          error: {
            code: "SELF_DEACTIVATION_PREVENTED",
            message: "You cannot deactivate or suspend your own account.",
          },
        });
      }
    }

    // Name validations
    const firstNameError = getInvalidNameReason(firstName, "First name");
    if (firstNameError) fieldErrors.first_name = firstNameError;
    const middleNameError = middleName
      ? getInvalidNameReason(middleName, "Middle name")
      : null;
    if (middleNameError) fieldErrors.middle_name = middleNameError;
    const lastNameError = getInvalidNameReason(lastName, "Last name");
    if (lastNameError) fieldErrors.last_name = lastNameError;

    // Email validation
    if (!email) {
      fieldErrors.email = "Email is required.";
    } else if (!isEmailFormatValid(email)) {
      fieldErrors.email = "Enter a valid email address.";
    }

    // Phone validation
    let normalizedPhone = null;
    if (rawPhone) {
      const phoneResult = validatePhone(rawPhone);
      if (!phoneResult.valid) {
        fieldErrors.phone_number = phoneResult.error;
      } else {
        normalizedPhone = phoneResult.normalized;
      }
    }

    // Password validation (if supplied)
    if (newPassword) {
      const passwordError = getPasswordError(newPassword);
      if (passwordError) {
        fieldErrors.password = passwordError;
      } else if (!isPasswordStrongEnough(newPassword)) {
        fieldErrors.password =
          "Password must meet at least 3 of: 8+ characters, uppercase, lowercase, number, special character.";
      }
    }

    if (!VALID_ROLES.includes(role)) {
      fieldErrors.role = `Role must be one of: ${VALID_ROLES.join(", ")}`;
    }
    if (!VALID_STATUSES.includes(accountStatus)) {
      fieldErrors.account_status = `Status must be one of: ${VALID_STATUSES.join(", ")}`;
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Please fix the highlighted fields.",
          fieldErrors,
        },
      });
    }

    // Check duplicate email (excluding target user)
    const [dupEmail] = await pool.query(
      "SELECT user_id FROM users WHERE email = ? AND user_id != ? LIMIT 1",
      [email, targetUserId],
    );
    if (dupEmail.length > 0) {
      return res.status(409).json({
        error: {
          code: "EMAIL_IN_USE",
          message: "Email is already registered to another account.",
          fieldErrors: { email: "Email is already registered." },
        },
      });
    }

    // Check duplicate phone (excluding target user)
    if (normalizedPhone) {
      const [dupPhone] = await pool.query(
        "SELECT user_id FROM users WHERE phone_number = ? AND user_id != ? LIMIT 1",
        [normalizedPhone, targetUserId],
      );
      if (dupPhone.length > 0) {
        return res.status(409).json({
          error: {
            code: "PHONE_IN_USE",
            message: "Phone number is already in use by another account.",
            fieldErrors: { phone_number: "Phone number is already in use." },
          },
        });
      }
    }

    // Build update SQL
    const updates = [
      "first_name = ?",
      "middle_name = ?",
      "last_name = ?",
      "email = ?",
      "phone_number = ?",
      "role = ?",
      "account_status = ?",
      "updated_at = CURRENT_TIMESTAMP",
    ];
    const updateParams = [
      firstName,
      middleName || null,
      lastName,
      email,
      normalizedPhone,
      role,
      accountStatus,
    ];

    // If changing password or deactivating, invalidate active sessions
    let shouldBumpToken = false;

    if (newPassword) {
      const password_hash = await bcrypt.hash(newPassword, 12);
      updates.push("password_hash = ?");
      updateParams.push(password_hash);
      shouldBumpToken = true;
    }

    if (
      existingUser.account_status === "Active" &&
      accountStatus !== "Active"
    ) {
      shouldBumpToken = true;
    }

    if (shouldBumpToken) {
      updates.push("token_version = token_version + 1");
    }

    updateParams.push(targetUserId);

    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`,
      updateParams,
    );

    logActivity({
      actorUserId: currentAdminId,
      actorRole: "Admin",
      activityType: "user_updated",
      action: `updated user details for #${targetUserId} (${email})`,
    }).catch((err) => console.error("Activity log failed (user_updated):", err));

    res.status(200).json({
      message: "User updated successfully.",
      user: {
        user_id: targetUserId,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        email,
        phone_number: normalizedPhone,
        role,
        account_status: accountStatus,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      const isEmailDup = String(error.sqlMessage ?? "").includes("email");
      return res.status(409).json({
        error: {
          code: isEmailDup ? "EMAIL_IN_USE" : "PHONE_IN_USE",
          message: isEmailDup
            ? "Email is already registered."
            : "Phone number is already registered.",
        },
      });
    }
    console.error("Error updating user:", error);
    res.status(500).json({
      error: { code: "DATABASE_ERROR", message: "Failed to update user." },
    });
  }
}

/**
 * Admin activate/deactivate/suspend user account status directly.
 */
export async function setUserStatus(req, res) {
  try {
    const targetUserId = Number(req.params.id);
    const currentAdminId = Number(req.auth?.sub);
    const { account_status } = req.body;

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid user ID." },
      });
    }

    if (!account_status || !VALID_STATUSES.includes(account_status)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `account_status must be one of: ${VALID_STATUSES.join(", ")}`,
        },
      });
    }

    if (currentAdminId === targetUserId && account_status !== "Active") {
      return res.status(400).json({
        error: {
          code: "SELF_DEACTIVATION_PREVENTED",
          message: "You cannot deactivate or suspend your own account.",
        },
      });
    }

    const [existing] = await pool.query(
      "SELECT user_id, email, first_name, last_name, role, account_status FROM users WHERE user_id = ? LIMIT 1",
      [targetUserId],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found." },
      });
    }

    const user = existing[0];

    // If deactivating, bump token_version to invalidate active sessions immediately
    const bumpToken = account_status !== "Active" ? ", token_version = token_version + 1" : "";

    await pool.query(
      `UPDATE users SET account_status = ?${bumpToken}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [account_status, targetUserId],
    );

    const actionText =
      account_status === "Active"
        ? `activated account of user #${targetUserId} (${user.email})`
        : `deactivated account of user #${targetUserId} (${user.email}) - status set to ${account_status}`;

    logActivity({
      actorUserId: currentAdminId,
      actorRole: "Admin",
      activityType: "user_status_changed",
      action: actionText,
    }).catch((err) =>
      console.error("Activity log failed (user_status_changed):", err),
    );

    res.status(200).json({
      message: `User status changed to ${account_status} successfully.`,
      user_id: targetUserId,
      account_status,
    });
  } catch (error) {
    console.error("Error setting user status:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to update user status.",
      },
    });
  }
}
