import { pool } from "../db/pool.js";

// ─────────────────────────────────────────────────────────────────────────────
// Date occupancy rules — single source of truth for availability.
//
// A date is unavailable when it is at CAPACITY_PER_DAY booking(s) OR when an
// admin has explicitly blocked it (e.g. a rest day after an event).
//
// The bookings that HOLD a date are BOTH pending ones (awaiting verification,
// so two customers can never claim the same day) and accepted/confirmed ones.
// Bookings that will never occupy the venue are excluded so they free the
// date again:
//   - Cancelled / Rejected  → the date becomes available immediately
//   - Completed             → event already happened (never in the future feed)
// ─────────────────────────────────────────────────────────────────────────────

export const OCCUPYING_BOOKING_STATUSES = ["Pending", "Reserved", "Confirmed"];

// Statuses shown on the public "Private Dining Schedule" calendar. Pending
// bookings hold the date but are not yet confirmed events, so they are not
// shown to visitors.
export const ACTIVE_BOOKING_STATUSES = ["Reserved", "Confirmed"];

// Maximum number of bookings allowed per day (strictly one booking per day).
export const CAPACITY_PER_DAY = 1;

/**
 * Single source of truth for date availability.
 * Returns the unavailable date strings (today or later) together with the
 * booking count and optional admin block reason. Merges occupied bookings and
 * admin-blocked dates. Cancelled, rejected, and completed bookings are always
 * excluded; blocking a date also fully occupies it.
 */
export async function getDateOccupancy() {
  const [bookingRows] = await pool.query(
    `SELECT DATE_FORMAT(b.event_date, '%Y-%m-%d') AS event_date,
            COUNT(*) AS booking_count,
            NULL AS reason
     FROM bookings b
     WHERE b.booking_status IN (?, ?, ?)
       AND b.event_date >= CURDATE()
     GROUP BY b.event_date`,
    OCCUPYING_BOOKING_STATUSES,
  );

  const [blockedRows] = await pool.query(
    `SELECT DATE_FORMAT(bd.blocked_date, '%Y-%m-%d') AS event_date,
            0 AS booking_count,
            bd.reason
     FROM blocked_dates bd
     WHERE bd.blocked_date >= CURDATE()`,
  );

  // Blocked dates and occupied bookings can overlap; a blocked date is fully
  // occupied so its reason takes precedence when listing.
  const byDate = new Map();
  for (const row of blockedRows) {
    byDate.set(row.event_date, {
      event_date: row.event_date,
      booking_count: CAPACITY_PER_DAY,
      reason: row.reason || null,
      status: "blocked",
    });
  }
  for (const row of bookingRows) {
    const existing = byDate.get(row.event_date);
    if (existing && existing.status === "blocked") continue;
    byDate.set(row.event_date, {
      event_date: row.event_date,
      booking_count: row.booking_count,
      reason: null,
      status: "booked",
    });
  }

  const occupiedDays = [...byDate.values()].sort((a, b) =>
    a.event_date.localeCompare(b.event_date),
  );

  return {
    capacityPerDay: CAPACITY_PER_DAY,
    occupiedDays,
  };
}

/**
 * Whether a specific date (YYYY-MM-DD) is unavailable: either admin-blocked
 * or already at capacity with bookings (optionally ignoring one booking, e.g.
 * the booking being verified). Accepts a transaction `connection` or the
 * `pool` so it can see uncommitted rows inside transactions.
 */
export async function isDateUnavailable(
  queryable,
  eventDate,
  excludeBookingId = null,
) {
  // 1. Admin-declared blocked date?
  const [blocked] = await queryable.query(
    "SELECT blocked_date_id FROM blocked_dates WHERE blocked_date = ? LIMIT 1",
    [eventDate],
  );
  if (blocked.length > 0) return true;

  // 2. Bookings already at capacity?
  const params = [...OCCUPYING_BOOKING_STATUSES, eventDate];
  let whereClause =
    "booking_status IN (?, ?, ?) AND event_date = ?";
  if (excludeBookingId != null) {
    whereClause += " AND booking_id != ?";
    params.push(excludeBookingId);
  }
  const [rows] = await queryable.query(
    `SELECT COUNT(*) AS count FROM bookings
     WHERE ${whereClause}
     HAVING COUNT(*) >= ?`,
    [...params, CAPACITY_PER_DAY],
  );
  return rows.length > 0;
}