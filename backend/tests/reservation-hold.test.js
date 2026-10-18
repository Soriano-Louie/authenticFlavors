import test from 'node:test';
import assert from 'node:assert/strict';
for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'GEMINI_API_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME']) {
  process.env[key] = key === 'DB_PORT' ? '3306' : 'test';
}
const { pool } = await import('../src/db/pool.js');
const { expireUnpaidHolds } = await import('../src/services/reservationHoldService.js');
const { checkPaymentReminders } = await import('../src/services/reminderSchedulerService.js');
const { sendBookingSubmittedEmail } = await import('../src/services/emailService.js');

test('expiration query excludes paid and under-review receipts without a review-age cutoff', async t => {
  let locked = false, selected = false;
  t.mock.method(pool, 'getConnection', async () => ({
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    query: async sql => {
      if (sql.includes('booking_calendar_lock')) { locked = true; return [[]]; }
      assert.ok(locked);
      assert.match(sql, /reservation_expires_at <= NOW\(\)/);
      assert.match(sql, /NOT EXISTS/);
      assert.match(sql, /payment_status IN \('Paid', 'For_Verification'\)/);
      assert.doesNotMatch(sql, /receipt_uploaded_at/);
      selected = true;
      return [[]];
    },
  }));
  await expireUnpaidHolds();
  assert.ok(selected);
});

test('receipt uploaded after reminder scan cannot be overwritten as overdue', async t => {
  let guardedUpdate = false;
  t.mock.method(pool, 'query', async sql => {
    if (sql.includes('SELECT') && sql.includes('FROM payments p')) return [[{
      payment_id: 1, booking_id: 2, payment_type: 'Reservation', payment_status: 'Pending',
      amount: 5000, due_date: '2000-01-01', days_until_due: -1,
    }]];
    if (sql.includes('UPDATE payments')) {
      assert.match(sql, /AND payment_status = 'Pending'/);
      guardedUpdate = true;
      return [{ affectedRows: 0 }];
    }
    throw new Error('Must not send an overdue reminder after the payment status changes');
  });
  await checkPaymentReminders();
  assert.ok(guardedUpdate);
});

test('booking email explains receipt deadline and protection throughout admin review', async t => {
  t.mock.method(pool, 'query', async () => [{ insertId: 1, affectedRows: 1 }]);
  let html;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    html = JSON.parse(options.body).htmlContent;
    return Response.json({ messageId: 'test' });
  });
  await sendBookingSubmittedEmail('test@example.com', 'Test', {
    booking_reference: 'AF-123456', event_date: '2099-11-01', reservation_amount: 5000,
    reservation_deadline: 'October 19, 2099 at 09:00 PM',
  });
  assert.match(html, /5,000.00/);
  assert.match(html, /October 19, 2099 at 09:00 PM/);
  assert.match(html, /Philippine Time, UTC\+8/);
  assert.match(html, /24 hours from booking creation/);
  assert.match(html, /even if verification takes longer than 24 hours/);
  assert.match(html, /does not confirm the booking/);
});
