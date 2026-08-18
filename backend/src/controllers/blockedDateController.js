import { pool } from "../db/pool.js";
import { logActivity } from "../services/activityService.js";
import { getPhilippineDateString } from "../utils/timezone.js";

// Admin: list all blocked dates (for management).
export async function getBlockedDates(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT bd.blocked_date_id,
              DATE_FORMAT(bd.blocked_date, '%Y-%m-%d') AS blocked_date,
              bd.reason,
              bd.created_at,
              u.first_name,
              u.last_name
       FROM blocked_dates bd
       LEFT JOIN users u ON bd.blocked_by = u.user_id
       ORDER BY bd.blocked_date DESC`,
    );

    res.status(200).json({
      blockedDates: rows.map((r) => ({
        blocked_date_id: r.blocked_date_id,
        blocked_date: r.blocked_date,
        reason: r.reason,
        created_at: r.created_at,
        blocked_by_name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch blocked dates:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to fetch blocked dates.",
      },
    });
  }
}

// Admin: block a day (e.g. a rest day after an event). The date is treated as
// fully occupied by the availability source of truth from the moment it is
// saved, so no new bookings can be taken for it.
export async function createBlockedDate(req, res) {
  try {
    const blockDate = String(req.body?.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Please provide a valid date (YYYY-MM-DD).",
        },
      });
    }

    const todayStr = getPhilippineDateString();
    if (blockDate < todayStr) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "You can only block today or a future date.",
        },
      });
    }

    const reasonText =
      typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim().slice(0, 255)
        : null;

    const [result] = await pool.query(
      "INSERT INTO blocked_dates (blocked_date, reason, blocked_by) VALUES (?, ?, ?)",
      [blockDate, reasonText, Number(req.auth?.sub) || null],
    );

    logActivity({
      actorUserId: Number(req.auth?.sub) || null,
      actorRole: "Admin",
      activityType: "date_blocked",
      action: `blocked ${blockDate} from the booking calendar${
        reasonText ? ` - ${reasonText}` : ""
      }`,
    }).catch((err) =>
      console.error("Activity logging failed (date_blocked):", err),
    );

    res.status(201).json({
      message: "Date blocked successfully.",
      blocked_date_id: result.insertId,
      blocked_date: blockDate,
      reason: reasonText,
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "ALREADY_BLOCKED",
          message: "This date is already blocked.",
        },
      });
    }
    console.error("Failed to block date:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to block date.",
      },
    });
  }
}

// Admin: remove a blocked date, making the day available again.
export async function deleteBlockedDate(req, res) {
  try {
    const blockedDateId = Number(req.params.id);
    if (!Number.isInteger(blockedDateId) || blockedDateId <= 0) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid blocked date id." },
      });
    }

    const [existing] = await pool.query(
      "SELECT blocked_date FROM blocked_dates WHERE blocked_date_id = ?",
      [blockedDateId],
    );
    if (existing.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Blocked date not found." },
      });
    }

    await pool.query(
      "DELETE FROM blocked_dates WHERE blocked_date_id = ?",
      [blockedDateId],
    );

    logActivity({
      actorUserId: Number(req.auth?.sub) || null,
      actorRole: "Admin",
      activityType: "date_unblocked",
      action: `unblocked ${existing[0].blocked_date} on the booking calendar`,
    }).catch((err) =>
      console.error("Activity logging failed (date_unblocked):", err),
    );

    res.status(200).json({ message: "Blocked date removed successfully." });
  } catch (error) {
    console.error("Failed to remove blocked date:", error);
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "Failed to remove blocked date.",
      },
    });
  }
}