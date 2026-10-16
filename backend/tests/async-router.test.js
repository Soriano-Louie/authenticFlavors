import test from 'node:test';
import assert from 'node:assert/strict';
import { asyncRouter } from '../src/middleware/asyncRouter.js';

test('Express 4 forwards async middleware and controller failures', async () => {
  const router = asyncRouter();
  router.get('/failure', async () => { throw Object.assign(new Error('unavailable'), { status: 503 }); });
  router.get('/ok', (_req, _res, next) => next(), async (_req, res) => res.json({ ok: true }));
  const dispatch = path => new Promise((resolve, reject) => {
    const res = { json: body => resolve({ status: 200, body }) };
    router.handle({ method: 'GET', url: path, headers: {} }, res, error => {
      if (!error) return reject(new Error('Route did not respond'));
      resolve({ status: error.status || 500, body: { error: error.message } });
    });
  });
  assert.equal((await dispatch('/failure')).status, 503);
  assert.deepEqual((await dispatch('/ok')).body, { ok: true });
});
