import { pool } from '../db/pool.js';

// A real row exists even when a date has no bookings. This avoids depending
// on empty-range/gap-lock behavior or the database's isolation level.
export async function lockBookingCalendar(db) {
  await db.query('SELECT lock_id FROM booking_calendar_lock WHERE lock_id = 1 FOR UPDATE');
}

export async function expireUnpaidHolds() {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    await lockBookingCalendar(db);
    // Submitted receipts remain protected for the entire admin review, even
    // after reservation_expires_at. Only unprotected unpaid holds expire.
    const [bookings] = await db.query(`SELECT b.booking_id FROM bookings b
      WHERE b.booking_status = 'Pending' AND b.reservation_expires_at <= NOW()
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.booking_id
          AND p.payment_status IN ('Paid', 'For_Verification')) FOR UPDATE`);
    for (const booking of bookings) {
      await db.query(`UPDATE payments SET payment_status = 'Cancelled'
        WHERE booking_id = ? AND payment_status IN ('Pending', 'Overdue', 'Rejected', 'Failed')`, [booking.booking_id]);
      await db.query(`UPDATE bookings SET booking_status = 'Cancelled', updated_at = NOW()
        WHERE booking_id = ? AND booking_status = 'Pending'`, [booking.booking_id]);
      await db.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, link)
        SELECT user_id, booking_id, 'reservation_expired', 'Reservation hold expired',
          'Your unpaid reservation hold expired after 24 hours. Please create a new booking if you still wish to reserve.', '/dashboard'
        FROM bookings WHERE booking_id = ?`, [booking.booking_id]);
    }
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
