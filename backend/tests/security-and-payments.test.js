import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMenuSelection, assertPaymentOrder, repriceMenu, reconcileInstallments } from '../src/services/bookingRulesService.js';

const items = [
  { menu_item_id: 1, category_id: 1, item_name: 'Soup', additional_price: 100 },
  { menu_item_id: 2, category_id: 2, item_name: 'Chicken', additional_price: 500 },
  { menu_item_id: 3, category_id: 2, item_name: 'Pork', additional_price: 300 },
];
for (const selections of [[], [' '], ['Soup'], ['Soup', 'Soup'], ['Soup', 'Unknown'], ['Soup', 'Chicken', 'Pork']]) {
  test(`reject incomplete/invalid menu ${JSON.stringify(selections)}`, () => {
    assert.throws(() => validateMenuSelection(items, [1, 2], selections), { code: 'VALIDATION_ERROR' });
  });
}
test('accept exactly one included menu item per category', () => {
  assert.equal(validateMenuSelection(items, [1, 2], [' soup ', 'Chicken']).length, 2);
});

const paidReservation = { payment_type: 'Reservation', payment_status: 'Paid', amount: 5000 };
const unpaidDown = { payment_type: 'DownPayment', payment_status: 'Pending', amount: 11750 };
for (const previous of [[], [paidReservation], [paidReservation, unpaidDown]]) {
  test(`final payment requires both verified stages ${JSON.stringify(previous)}`, () => {
    assert.throws(() => assertPaymentOrder({ payment_type: 'FinalPayment' }, previous, 'Confirmed'), { code: 'PREVIOUS_PAYMENTS_REQUIRED' });
  });
}
test('completed events can settle a remaining balance', () => {
  assert.doesNotThrow(() => assertPaymentOrder({ payment_type: 'FinalPayment' }, [paidReservation, { ...unpaidDown, payment_status: 'Paid' }], 'Completed'));
});
test('cancelled bookings cannot accept payments', () => {
  assert.throws(() => assertPaymentOrder({ payment_type: 'Reservation' }, [], 'Cancelled'), { code: 'INVALID_STATE' });
});
test('zero-value previous stages do not block settlement', () => {
  assert.doesNotThrow(() => assertPaymentOrder({ payment_type: 'FinalPayment' }, [paidReservation, { ...unpaidDown, amount: 0, payment_status: 'Cancelled' }], 'Completed'));
});

test('repricing preserves agreed surcharges and percentage discount', () => {
  const snapshot = { base_price: 28000, discount: { type: 'percentage', value: 10 }, items: { 1: 100, 2: 500 } };
  const unchanged = repriceMenu(snapshot, [{ ...items[0], additional_price: 999 }, { ...items[1], additional_price: 888 }]);
  assert.equal(unchanged.total, 25740);
  const changed = repriceMenu(snapshot, [items[0], items[2]]);
  assert.equal(changed.total, 25560);
  assert.equal(changed.reduction, 2840);
});
test('legacy price history must not be guessed', () => {
  assert.throws(() => repriceMenu(null, items), { code: 'PRICING_REVIEW_REQUIRED' });
});
const ledger = [
  { payment_id: 1, ...paidReservation },
  { payment_id: 2, ...unpaidDown },
  { payment_id: 3, payment_type: 'FinalPayment', payment_status: 'Pending', amount: 11750 },
];
for (const total of [27000, 28500, 31000, 4000]) {
  test(`installments reconcile after menu total changes to ${total}`, () => {
    const plan = reconcileInstallments(ledger, total);
    assert.equal(plan.changes.reduce((n, p) => n + p.amount, 0) + plan.newFinal, plan.remaining);
    assert.equal(plan.paid + plan.remaining - plan.credit, total);
  });
}
test('receipts under verification cannot have their amount changed', () => {
  assert.throws(() => reconcileInstallments([...ledger, { payment_status: 'For_Verification' }], 30000), { code: 'PAYMENT_REVIEW_REQUIRED' });
});
test('fully paid booking upgrade creates only the unpaid difference', () => {
  const plan = reconcileInstallments(ledger.map(p => ({ ...p, payment_status: 'Paid' })), 30000);
  assert.equal(plan.newFinal, 1500);
  assert.equal(plan.paid, 28500);
});

// Import controllers only with fake configuration; all infrastructure is mocked.
for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'GEMINI_API_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME']) {
  process.env[key] = key === 'DB_PORT' ? '3306' : 'test';
}
const { pool } = await import('../src/db/pool.js');
const { uploadReceipt, getReceipt, verifyReceipt } = await import('../src/controllers/paymentController.js');
const { autoCompletePastBookings, createBooking } = await import('../src/controllers/bookingController.js');

function responseRecorder() {
  return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
test('direct receipt metadata endpoint cannot write or delete assets', async t => {
  t.mock.method(pool, 'getConnection', () => { throw new Error('must not access database'); });
  const res = responseRecorder();
  await uploadReceipt({ body: { receipt_public_id: 'someone-elses-image' } }, res);
  assert.equal(res.code, 410);
});
test('receipt endpoint refuses another customers receipt without fetching it', async t => {
  t.mock.method(pool, 'query', async () => [[{ user_id: 9, receipt_url: 'https://example.com/private' }]]);
  t.mock.method(globalThis, 'fetch', () => { throw new Error('must not fetch'); });
  const res = responseRecorder();
  await getReceipt({ auth: { sub: '2', role: 'Customer' }, params: { paymentId: 1 } }, res);
  assert.equal(res.code, 404);
});
test('completion sweep never cancels debts or completes unverified pending bookings', async t => {
  const queries = [];
  t.mock.method(pool, 'query', async (sql) => { queries.push(sql); return [{ affectedRows: 1 }]; });
  await autoCompletePastBookings();
  assert.equal(queries.length, 1);
  assert.match(queries[0], /booking_status IN \('Reserved', 'Confirmed'\)/);
  assert.doesNotMatch(queries[0], /UPDATE payments|For_Verification/);
});
test('connection acquisition failures return controlled errors', async t => {
  t.mock.method(pool, 'getConnection', async () => { throw new Error('database unavailable'); });
  t.mock.method(console, 'error', () => {});
  const res = responseRecorder();
  await verifyReceipt({ auth: { sub: '1' }, body: {}, params: {} }, res);
  assert.equal(res.code, 500);
  const bookingRes = responseRecorder();
  await createBooking({ auth: { sub: '2', role: 'Customer' }, body: { package_id: 1, number_of_pax: 30, event_date: '2099-01-01', start_time: '12:00', contact_name: 'Test', contact_email: 'test@example.com', event_type_name: 'Birthday' } }, bookingRes);
  assert.equal(bookingRes.code, 500);
});
test('receipt approval keeps Completed status and uses ledger paid total', async t => {
  const payment = { payment_id: 3, booking_id: 1, payment_type: 'FinalPayment', payment_status: 'For_Verification',
    receipt_url: 'stored', booking_status: 'Completed', amount_paid: 1, amount: 11750, total_price: 28500, event_date: '2026-01-01' };
  let committed = false;
  let bookingUpdate;
  t.mock.method(pool, 'query', async () => [{ insertId: 1 }]);
  t.mock.method(pool, 'getConnection', async () => ({
    beginTransaction: async () => {}, rollback: async () => {}, release() {}, commit: async () => { committed = true; },
    query: async (sql, params) => {
      if (sql.startsWith('SELECT booking_id FROM payments')) return [[{ booking_id: 1 }]];
      if (sql.includes('SELECT p.*')) return [[payment]];
      if (sql.includes('SELECT payment_type, payment_status, amount')) return [[paidReservation, { ...unpaidDown, payment_status: 'Paid' }]];
      if (sql.includes('AS paid_total')) return [[{ paid_total: 28500 }]];
      if (sql.includes('UPDATE bookings')) bookingUpdate = params;
      return [{ affectedRows: 1 }];
    },
  }));
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({}) }));
  const res = responseRecorder();
  await verifyReceipt({ auth: { sub: '1' }, params: { paymentId: 3 }, body: { action: 'approve' } }, res);
  assert.equal(res.code, 200);
  assert.ok(committed);
  assert.deepEqual(bookingUpdate.slice(0, 3), ['Completed', 28500, 0]);
});

test('booking creation rejects inactive packages inside its transaction', async t => {
  let checkedPackage = false;
  let insertedBooking = false;
  t.mock.method(pool, 'getConnection', async () => ({
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
    query: async sql => {
      if (sql.includes('INSERT INTO bookings')) insertedBooking = true;
      if (sql.includes('SELECT event_type_id')) return [[{ event_type_id: 1 }]];
      if (sql.includes('SELECT venue_setup_id')) return [[{ venue_setup_id: 1 }]];
      if (sql.includes('SELECT pp.price')) {
        assert.match(sql, /pkg.status = 'Active' FOR UPDATE/);
        checkedPackage = true;
      }
      return [[]];
    },
  }));
  const res = responseRecorder();
  await createBooking({ auth: { sub: '2', role: 'Customer' }, body: {
    package_id: 1, number_of_pax: 30, event_date: '2099-01-01', start_time: '12:00',
    contact_name: 'Test', contact_email: 'test@example.com', event_type_name: 'Birthday', menu_selections: ['Soup'],
  } }, res);
  assert.equal(res.code, 400);
  assert.ok(checkedPackage);
  assert.equal(insertedBooking, false);
});
