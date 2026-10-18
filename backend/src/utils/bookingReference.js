import crypto from "node:crypto";

// All new bookings share one namespace. Also reserve historical chatbot numbers,
// which were stored only in ai_booking_reference and displayed with an AF prefix.
export async function generateUniqueBookingReference(connection) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const digits = crypto.randomInt(100000, 1000000);
    const reference = `AF-${digits}`;
    const [rows] = await connection.query(
      `SELECT booking_id FROM bookings
       WHERE booking_reference = ? OR ai_booking_reference = ? LIMIT 1`,
      [reference, digits],
    );
    if (rows.length === 0) return reference;
  }
  throw new Error("Unable to generate a unique booking reference.");
}
