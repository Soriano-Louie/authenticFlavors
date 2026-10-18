import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { generateUniqueBookingReference } from '../src/utils/bookingReference.js';

test('AF references skip both historical chatbot and current reference collisions', async t => {
  const candidates = [123456, 234567, 345678];
  t.mock.method(crypto, 'randomInt', () => candidates.shift());
  const existing = [
    { booking_reference: null, ai_booking_reference: 123456 },
    { booking_reference: 'AF-234567', ai_booking_reference: null },
  ];
  const connection = { query: async (sql, [reference, digits]) => {
    assert.match(sql, /booking_reference = \? OR ai_booking_reference = \?/);
    return [existing.filter(row => row.booking_reference === reference || row.ai_booking_reference === digits)];
  } };
  assert.equal(await generateUniqueBookingReference(connection), 'AF-345678');
});

test('reference generation stops when every candidate is taken', async () => {
  let attempts = 0;
  await assert.rejects(generateUniqueBookingReference({ query: async () => {
    attempts++;
    return [[{ booking_id: 1 }]];
  } }), /Unable to generate/);
  assert.equal(attempts, 5);
});
