import test from 'node:test';
import assert from 'node:assert/strict';
for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'GEMINI_API_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME']) {
  process.env[key] = key === 'DB_PORT' ? '3306' : 'test';
}
const { pool } = await import('../src/db/pool.js');
const { sendMessage, findKnowledgeBaseAnswer } = await import('../src/controllers/chatbotController.js');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
for (const message of [null, {}, ' ', 'a'.repeat(2001)]) {
  test(`invalid chat input is rejected before database or AI calls: ${typeof message}`, async t => {
    t.mock.method(pool, 'query', async () => { throw new Error('must not query'); });
    const res = response();
    await sendMessage({ body: { message } }, res);
    assert.equal(res.code, 400);
  });
}
test('another account cannot continue a conversation', async t => {
  t.mock.method(pool, 'query', async (sql, params) => {
    assert.match(sql, /conversation_id = \? AND user_id = \?/);
    assert.deepEqual(params, [12, 5]);
    return [[]];
  });
  const res = response();
  await sendMessage({ body: { message: 'Hello', conversation_id: 12 }, auth: { sub: '5' } }, res);
  assert.equal(res.code, 404);
});
test('schedule and availability questions never return canned opening hours', async t => {
  t.mock.method(pool, 'query', async () => { throw new Error('must use live context'); });
  for (const question of ['Show the private dining schedule', 'Is November 1 available?', 'Why is this date temporarily held?']) {
    assert.equal(await findKnowledgeBaseAnswer(question), null);
  }
});
