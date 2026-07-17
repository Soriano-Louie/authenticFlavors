import { pool } from "../db/pool.js";

/**
 * Retrieves the total number of successfully completed events.
 */
export async function getEventsHostedCount() {
  const [result] = await pool.query(
    "SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'Completed'"
  );
  return result[0].count;
}

/**
 * Calculates happy guests by summing number_of_pax of all completed bookings.
 * In the future, this can be updated to only count guests from bookings
 * that received positive feedback (e.g. JOIN feedback ... WHERE rating >= 4).
 */
export async function getHappyGuestsCount() {
  const [result] = await pool.query(
    "SELECT SUM(number_of_pax) as total FROM bookings WHERE booking_status = 'Completed'"
  );
  return result[0].total || 0;
}

/**
 * Calculates average rating from the feedback table.
 * Returns null when there is no feedback yet.
 */
export async function getAverageRating() {
  const [result] = await pool.query(
    "SELECT AVG(rating) as avgRating, COUNT(*) as total FROM feedback"
  );
  const avg = result[0]?.avgRating;
  if (!avg || result[0]?.total === 0) {
    return null;
  }
  return Math.round(Number(avg) * 10) / 10;
}
