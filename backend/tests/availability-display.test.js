import test from 'node:test';
import assert from 'node:assert/strict';

for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'GEMINI_API_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME']) {
  process.env[key] = key === 'DB_PORT' ? '3306' : 'test';
}
const { pool } = await import('../src/db/pool.js');
const { getDateOccupancy } = await import('../src/services/availabilityService.js');

test('public availability distinguishes pending holds, accepted bookings and admin blocks', async t => {
  t.mock.method(pool, 'getConnection', async () => ({
    beginTransaction: async () => {}, commit: async () => {},
    rollback: async () => {}, release: () => {}, query: async () => [[]],
  }));
  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM bookings b')) {
      assert.deepEqual(params, ['Pending', 'Reserved', 'Confirmed']);
      assert.match(sql, /SUM\(b.booking_status IN \('Reserved', 'Confirmed'\)\)/);
      return [[
        { event_date: '2099-11-01', booking_count: 1, accepted_count: '0' },
        { event_date: '2099-11-02', booking_count: 1, accepted_count: '1' },
        { event_date: '2099-11-03', booking_count: 1, accepted_count: '0' },
      ]];
    }
    return [[{ event_date: '2099-11-03', reason: 'Closed' }]];
  });
  const result = await getDateOccupancy();
  assert.deepEqual(result.occupiedDays.map(day => day.status), ['held', 'booked', 'blocked']);
  assert.equal(result.capacityPerDay, 1);
  assert.ok(result.occupiedDays.every(day => day.booking_count >= result.capacityPerDay));
  assert.equal(result.occupiedDays[2].reason, 'Closed');
});
