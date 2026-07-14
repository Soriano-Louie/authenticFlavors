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
 * Currently, the feedback module is not yet implemented, so this returns null
 * (representing "N/A").
 * 
 * Future implementation:
 * const [result] = await pool.query("SELECT AVG(rating) as avgRating FROM feedback");
 * return result[0].avgRating;
 */
export async function getAverageRating() {
  // Feedback module is not implemented yet.
  // Once the feedback table exists, uncomment/replace with the following:
  /*
  const [result] = await pool.query("SELECT AVG(rating) as avgRating FROM feedback");
  return result[0].avgRating;
  */
  return null;
}
