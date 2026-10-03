import test from 'node:test';
import assert from 'node:assert/strict';
import { getBookingCompletionCutoff, getPhilippineDateString } from '../src/utils/timezone.js';

for (const [instant, cutoff] of [
  ['2026-10-03T15:58:59Z', '2026-10-03'],
  ['2026-10-03T15:59:00Z', '2026-10-04'],
  ['2026-10-03T16:00:00Z', '2026-10-04'],
  ['2026-12-31T15:59:00Z', '2027-01-01'],
]) {
  test(`completion cutoff at ${instant}`, () => {
    assert.equal(getBookingCompletionCutoff(new Date(instant)), cutoff);
  });
}

// Use fake infrastructure only; never connect to the database or send real mail.
for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'GEMINI_API_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME']) {
  process.env[key] = key === 'DB_PORT' ? '3306' : 'test';
}
const { pool } = await import('../src/db/pool.js');
const { adminCancelEventDayBooking, calculateCancellationRefund } = await import('../src/controllers/bookingController.js');

for (const fails of [false, true]) {
  test(`event-day cancellation recommendation email ${fails ? 'failure' : 'success'}`, async (t) => {
    let committed = false;
    let request;
    t.mock.method(pool, 'query', async () => [{ insertId: 1 }]);
    t.mock.method(pool, 'getConnection', async () => ({
      beginTransaction: async () => {}, rollback: async () => {}, release() {},
      commit: async () => { committed = true; },
      query: async (sql, params) => {
        if (sql.includes('AS paid_total')) {
          assert.match(sql, /payment_status = 'Paid'/);
          assert.match(sql, /payment_type != 'CancellationCharge'/);
          return [[{ booking_id: 1, paid_total: '28500.00' }]];
        }
        if (sql.includes("SET booking_status = 'Cancelled'")) {
          assert.equal(params[0], 28500);
          assert.equal(params[1], 0);
        }
        return sql.includes('SELECT b.*') ? [[{
        booking_id: 1, user_id: 2, booking_status: 'Confirmed',
        event_date: getPhilippineDateString(), email: 'customer@example.com',
        first_name: 'Test', package_name: 'Celebration', amount_paid: 21750, total_price: 28500,
        booking_reference: 'BK-TEST',
      }]] : [{ affectedRows: 1 }];
      },
    }));
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.ok(committed, 'cancellation commits before email is sent');
      request = JSON.parse(options.body);
      return { ok: !fails, status: fails ? 500 : 201, json: async () => fails ? { message: 'test failure' } : { messageId: 'test-id' } };
    });
    t.mock.method(console, 'error', () => {});
    let payload;
    const res = { status(code) { assert.equal(code, 200); return this; }, json(body) { payload = body; } };
    await adminCancelEventDayBooking({ params: { id: '1' }, body: { cancellation_reason: 'Kitchen <closed>' } }, res);
    assert.equal(payload.booking_status, 'Cancelled');
    assert.equal(payload.refundable_amount, 28500);
    assert.ok(request.htmlContent.includes("28,500.00"));
    assert.equal(payload.email_status, fails ? 'failed' : 'sent');
    assert.equal(request.to[0].email, 'customer@example.com');
    for (const venue of ['LOLA', 'TA’GIG', 'LA LUNA', 'ORO PLATO']) {
      // Venue headings are rendered in uppercase in the existing template.
      assert.ok(request.htmlContent.toUpperCase().includes(venue.replace('’', "'")) || request.htmlContent.toUpperCase().includes(venue), venue);
    }
    assert.ok(request.htmlContent.includes('Kitchen &lt;closed&gt;'));
  });
}

const { applyBookingPaymentTotals } = await import('../src/services/bookingPaymentTotalsService.js');
test('existing cancelled booking refund includes all three paid stages', async () => {
  const booking = { booking_id: 1, total_price: 28500, amount_paid: 21750, remaining_balance: 6750 };
  await applyBookingPaymentTotals([booking], {
    query: async () => [[{ booking_id: 1, paid_total: 5000 + 11750 + 11750 }]],
  });
  assert.equal(booking.amount_paid, 28500);
  assert.equal(booking.remaining_balance, 0);
  assert.equal(calculateCancellationRefund(28500, booking.amount_paid, 'admin_event_day_cancellation').refundable_amount, 28500);
  assert.equal(calculateCancellationRefund(28500, booking.amount_paid, 'standard').refundable_amount, 23500);
  assert.equal(calculateCancellationRefund(28500, booking.amount_paid, '1_day_penalty').refundable_amount, 0);
});
test('partially paid booking refunds only the paid amount including reservation', async () => {
  const booking = { booking_id: 2, total_price: 28500, amount_paid: 28500 };
  await applyBookingPaymentTotals([booking], { query: async () => [[{ booking_id: 2, paid_total: 5000 }]] });
  assert.equal(calculateCancellationRefund(28500, booking.amount_paid, 'admin_event_day_cancellation').refundable_amount, 5000);
  assert.equal(booking.remaining_balance, 23500);
});
