import { pool } from "../db/pool.js";

// Paid installments are the source of truth, including the reservation fee.
// Cancellation charges are penalties, not payments toward the event package.
export async function applyBookingPaymentTotals(bookings, db = pool) {
  if (!bookings.length) return;
  const ids = bookings.map((booking) => booking.booking_id);
  const [totals] = await db.query(
    `SELECT booking_id, COALESCE(SUM(CASE WHEN payment_status = 'Paid'
       AND payment_type != 'CancellationCharge' THEN amount ELSE 0 END), 0) AS paid_total
     FROM payments WHERE booking_id IN (${ids.map(() => "?").join(",")})
     GROUP BY booking_id`,
    ids,
  );
  const byBooking = new Map(totals.map((row) => [Number(row.booking_id), Number(row.paid_total)]));
  for (const booking of bookings) {
    // Preserve legacy bookings with no payment records.
    if (!byBooking.has(Number(booking.booking_id))) continue;
    booking.amount_paid = Math.round(byBooking.get(Number(booking.booking_id)) * 100) / 100;
    booking.remaining_balance = Math.max(0,
      Math.round((Number(booking.total_price) - booking.amount_paid) * 100) / 100);
  }
}
