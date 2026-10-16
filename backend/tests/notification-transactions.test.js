import test from 'node:test';
import assert from 'node:assert/strict';

for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'GEMINI_API_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME']) {
  process.env[key] = key === 'DB_PORT' ? '3306' : 'test';
}
const { pool } = await import('../src/db/pool.js');
const { verifyBooking } = await import('../src/controllers/bookingController.js');
const { retryEmails } = await import('../src/services/emailOutboxService.js');
const { createNotification } = await import('../src/services/notificationService.js');
const { sendBookingConfirmedEmail } = await import('../src/services/emailService.js');
const { rejectMenuChangeRequest } = await import('../src/controllers/menuChangeController.js');

function response() {
  return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
}

for (const status of ['Reserved', 'Confirmed']) {
  for (const failure of [null, 'notification', 'outbox', 'commit']) {
    test(`${status} verification is atomic when ${failure || 'nothing'} fails`, async t => {
      let committed = false, rolledBack = false, released = false;
      let pendingEmail, savedEmail, notification, nextStatus;
      const db = {
        beginTransaction: async () => {},
        commit: async () => {
          if (failure === 'commit') throw new Error('commit failed');
          assert.ok(pendingEmail, 'email job must exist before commit');
          assert.ok(notification, 'notification must exist before commit');
          committed = true; savedEmail = pendingEmail;
        },
        rollback: async () => { rolledBack = true; pendingEmail = undefined; notification = undefined; },
        release: () => { released = true; },
        query: async (sql, params) => {
          if (sql.includes('SELECT b.booking_id')) return [[{
            booking_id: 1, user_id: 2, booking_status: 'Pending', total_price: 28500,
            amount_paid: status === 'Confirmed' ? 28500 : 5000,
            remaining_balance: status === 'Confirmed' ? 0 : 23500,
            email: 'customer@example.com', first_name: 'Test', event_date: '2099-01-01',
            booking_reference: 'BK-TEST', package_name: 'Package A',
          }]];
          if (sql.includes('blocked_dates') || sql.includes('SELECT COUNT(*)')) return [[]];
          if (sql.includes('SELECT payment_status')) return [[{ payment_status: 'Paid' }]];
          if (sql.includes('SELECT first_name')) return [[{ first_name: 'Admin', last_name: 'Test' }]];
          if (sql.includes('UPDATE bookings')) nextStatus = params[0];
          if (sql.includes('INSERT INTO notifications')) {
            if (failure === 'notification') throw new Error('notification storage failed');
            notification = params;
          }
          if (sql.includes('INSERT INTO email_outbox')) {
            if (failure === 'outbox') throw new Error('outbox storage failed');
            assert.equal(params[2], 0, 'transactional mail is immediately eligible after commit');
            pendingEmail = params[0];
          }
          return [{ affectedRows: 1, insertId: 1 }];
        },
      };
      t.mock.method(pool, 'getConnection', async () => db);
      t.mock.method(pool, 'query', async () => { throw new Error('transaction escaped to pool'); });
      t.mock.method(globalThis, 'fetch', async () => { throw new Error('provider must not be contacted before commit'); });
      t.mock.method(console, 'error', () => {});
      const res = response();
      await verifyBooking({ params: { id: 1 }, body: {}, auth: { sub: '10' } }, res);
      assert.ok(released);
      assert.equal(nextStatus, status);
      assert.equal(res.code, failure ? 500 : 200);
      assert.equal(committed, !failure);
      assert.equal(rolledBack, !!failure);
      if (failure) {
        assert.equal(savedEmail, undefined);
        assert.equal(notification, undefined);
        return;
      }
      assert.equal(res.body.booking_status, status);
      assert.equal(notification[3], `Booking ${status}`);
      assert.ok(notification[4].includes(status.toLowerCase()));
      let deleted = false, delivered;
      t.mock.method(pool, 'query', async sql => {
        if (sql.startsWith('SELECT outbox_id')) return [[{ outbox_id: 1, payload: savedEmail }]];
        if (sql.startsWith('UPDATE email_outbox')) return [{ affectedRows: 1 }];
        if (sql.includes('WHERE outbox_id = ?')) deleted = true;
        return [{ affectedRows: 1 }];
      });
      await retryEmails(async (to, subject, html) => { assert.ok(committed); delivered = { to, subject, html }; });
      assert.equal(delivered.to, 'customer@example.com');
      assert.match(delivered.subject, new RegExp(`Booking ${status}`));
      assert.ok(delivered.html.includes(`booking is ${status.toLowerCase()}`));
      assert.ok(delivered.html.includes(`officially ${status.toLowerCase()}`));
      assert.ok(deleted);
    });
  }
}

test('parallel notification transactions keep their email jobs on the correct connection', async t => {
  const rows = [[], []];
  t.mock.method(pool, 'query', async () => { throw new Error('must use transaction'); });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not send before commit'); });
  await Promise.all(rows.map((writes, i) => createNotification({
    userId: i + 1, type: 'booking_reserved', title: 'Reserved', message: 'Reserved',
    sendEmailFn: () => sendBookingConfirmedEmail(`user${i}@example.com`, 'Test', {
      booking_status: 'Reserved', event_date: '2099-01-01', booking_reference: `BK-${i}`,
    }),
  }, { query: async (sql, params) => { await Promise.resolve(); writes.push({ sql, params }); return [{ insertId: i + 1 }]; } })));
  for (const writes of rows) {
    assert.equal(writes.length, 2);
    assert.match(writes[0].sql, /INSERT INTO notifications/);
    assert.match(writes[1].sql, /INSERT INTO email_outbox/);
  }
  assert.equal(rows[0][0].params[0], 1);
  assert.equal(rows[1][0].params[0], 2);
  assert.notEqual(rows[0][1].params[0], rows[1][1].params[0]);
});

test('menu rejection rolls back if the email job cannot be persisted', async t => {
  let rolledBack = false, committed = false, released = false, changed = false;
  t.mock.method(pool, 'getConnection', async () => ({
    beginTransaction: async () => {}, commit: async () => { committed = true; },
    rollback: async () => { rolledBack = true; changed = false; }, release: () => { released = true; },
    query: async sql => {
      if (sql.includes('SELECT mcr.*')) {
        assert.match(sql, /FOR UPDATE/);
        return [[{ request_id: 1, status: 'Pending', booking_id: 1, user_id: 2,
          email: 'customer@example.com', first_name: 'Test', event_date: '2099-01-01' }]];
      }
      if (sql.includes('SELECT first_name')) return [[]];
      if (sql.includes('UPDATE menu_change_requests')) changed = true;
      if (sql.includes('INSERT INTO email_outbox')) throw new Error('cannot save email');
      return [{ affectedRows: 1, insertId: 1 }];
    },
  }));
  let error;
  await rejectMenuChangeRequest({ params: { requestId: 1 }, auth: { sub: '10' }, body: { rejection_reason: 'Unavailable' } }, response(), e => { error = e; });
  assert.match(error.message, /cannot save email/);
  assert.ok(rolledBack && released);
  assert.equal(committed, false);
  assert.equal(changed, false);
});
