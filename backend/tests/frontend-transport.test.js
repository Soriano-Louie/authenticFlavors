import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from '../../node_modules/typescript/lib/typescript.js';

async function loadTs(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText.replaceAll('import.meta.env', '({})')).toString('base64')}`);
}
const { escapeCSVField } = await loadTs('../../src/app/utils/exportUtils.ts');
for (const value of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', ' \t=HYPERLINK("example")']) {
  test(`CSV neutralizes formula text ${value}`, () => assert.ok(escapeCSVField(value).replace(/^"/, '').startsWith("'")));
}
test('CSV preserves real numbers and ordinary quoted text', () => {
  assert.equal(escapeCSVField(-12), '-12');
  assert.equal(escapeCSVField('a,b'), '"a,b"');
});
const { apiFetch, setSessionToken } = await loadTs('../../src/app/api/apiFetch.ts');
globalThis.window = new EventTarget();
const token = (sub, ver, suffix) => `header.${Buffer.from(JSON.stringify({ sub, ver })).toString('base64url')}.${suffix}`;
const old = token('2', 1, 'old');
const fresh = token('2', 1, 'new');
test('concurrent expired requests refresh once and retry with renewed token', async t => {
  setSessionToken(old);
  let refreshes = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).includes('/auth/refresh')) {
      refreshes++;
      await new Promise(resolve => setTimeout(resolve, 5));
      return Response.json({ accessToken: fresh, user: { user_id: 2 } });
    }
    return new Headers(options.headers).get('Authorization') === `Bearer ${fresh}`
      ? Response.json({ ok: true }) : Response.json({ error: { code: 'TOKEN_EXPIRED' } }, { status: 401 });
  });
  const responses = await Promise.all([1, 2, 3].map(() => apiFetch('/bookings', { headers: { Authorization: `Bearer ${old}` } })));
  assert.equal(refreshes, 1);
  assert.ok(responses.every(response => response.status === 200));
});
test('revoked sessions are never refreshed', async t => {
  setSessionToken(old);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }); });
  assert.equal((await apiFetch('/bookings', { headers: { Authorization: `Bearer ${old}` } })).status, 401);
  assert.equal(calls, 1);
});
test('refresh cannot silently switch to another account', async t => {
  setSessionToken(old);
  t.mock.method(globalThis, 'fetch', async url => String(url).includes('/auth/refresh')
    ? Response.json({ accessToken: token('3', 1, 'other'), user: { user_id: 3 } })
    : Response.json({ error: { code: 'TOKEN_EXPIRED' } }, { status: 401 }));
  assert.equal((await apiFetch('/bookings', { headers: { Authorization: `Bearer ${old}` } })).status, 401);
});
test('previous account requests are rejected before reaching server', async t => {
  setSessionToken(fresh);
  t.mock.method(globalThis, 'fetch', () => { throw new Error('must not send stale request'); });
  assert.equal((await apiFetch('/bookings', { headers: { Authorization: `Bearer ${old}` } })).status, 409);
});
