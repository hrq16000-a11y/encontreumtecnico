// PR344: disposable localhost HTTP + actual Supabase/PostgREST/Postgres.
// Test-only server: NOT imported by the EUT app, no production endpoint.
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const baseUrl = process.env.PR344_API_URL ?? '';
const anonKey = process.env.PR344_ANON_KEY ?? '';
const serviceKey = process.env.PR344_SERVICE_ROLE_KEY ?? '';
const pepper = process.env.PR344_TEST_PEPPER ?? '';
assert.equal(process.env.PR344_LOCAL_ONLY, 'yes');
assert.equal(process.env.SUPABASE_ACCESS_TOKEN ?? '', '');
assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(anonKey && serviceKey && anonKey !== serviceKey);
assert.match(pepper, /^[0-9a-f]{64}$/);

const config = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(baseUrl, serviceKey, config);
const publicClient = () => createClient(baseUrl, anonKey, config);
const anonymous = publicClient();
const technician = publicClient();
const administrator = publicClient();
const password = 'pr344-HTTP-local-only!2026';
const epoch = Math.floor(Date.now() / 60000) * 60000 + 5000;
let now = new Date(epoch);
let storageUnavailable = false;
let serverA;
let serverB;
let rootA = '';
let rootB = '';
let techToken = '';
let adminToken = '';
let adminUserId = '';

function digest(value) {
  return createHmac('sha256', Buffer.from(pepper, 'hex')).update(value).digest('hex');
}
function tab() { return randomBytes(16).toString('hex'); }
function at(seconds) { now = new Date(epoch + seconds * 1000); }
function respond(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (payload !== undefined) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  } else res.end();
}
async function readJson(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk.toString('utf8');
    if (Buffer.byteLength(text) > 512) throw new Error('oversize');
  }
  return JSON.parse(text);
}
function isExactBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (!['start', 'beat', 'leave'].includes(body.op)) return false;
  if (typeof body.tabToken !== 'string' || !/^[a-f0-9]{32}$/.test(body.tabToken)) return false;
  const allowed = body.op === 'leave' ? ['op', 'tabToken'] : ['consent', 'op', 'tabToken'];
  if (Object.keys(body).sort().join(',') !== allowed.join(',')) return false;
  return body.op === 'leave' || body.consent === true;
}
function makeServer() {
  const server = createServer(async (req, res) => {
    // Never trust the inbound Host header for the allowed origin.
    const origin = `http://127.0.0.1:${server.address().port}`;
    const pathname = new URL(req.url ?? '/', origin).pathname;
    if (req.method === 'POST' && pathname === '/api/presence/leases') {
      if (req.headers.origin !== origin ||
          (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) {
        return respond(res, 403);
      }
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return respond(res, 400);
      let body;
      try { body = await readJson(req); } catch { return respond(res, 400); }
      if (!isExactBody(body)) return respond(res, 400);
      if (storageUnavailable) return respond(res, 503);
      const bucket = digest(`bucket:${req.socket.remoteAddress}:${Math.floor(now.getTime() / 60000)}`);
      try {
        const { data, error } = await service.rpc('pr344_http_synthetic_apply', {
          _op: body.op, _tab_hash: digest(`tab:${body.tabToken}`),
          _bucket_hash: body.op === 'start' ? bucket : null, _at: now.toISOString(),
        });
        if (error) return respond(res, 503);
        if (data === 'ok') return respond(res, 204);
        if (data === 'rate') return respond(res, 429);
        if (data === 'gone') return respond(res, 410);
        return respond(res, 503);
      } catch { return respond(res, 503); }
    }
    if (req.method === 'GET' && pathname === '/api/admin/presence/count') {
      const header = req.headers.authorization ?? '';
      if (!/^Bearer [^.\s]+\.[^.\s]+\.[^.\s]+$/.test(header)) return respond(res, 401);
      try {
        const { data, error } = await anonymous.auth.getUser(header.slice(7));
        if (error || !data.user?.id) return respond(res, 401);
        // Current persisted role: no claims from user_metadata or client.
        const role = await service.from('pr344_http_synthetic_roles')
          .select('role').eq('user_id', data.user.id).eq('role', 'admin').maybeSingle();
        if (role.error) return respond(res, 503);
        if (!role.data) return respond(res, 403);
        if (storageUnavailable) return respond(res, 503);
        const counts = await service.from('pr344_http_synthetic_leases')
          .select('tab_hash', { count: 'exact', head: true })
          .eq('state', 'active').gt('expires_at', now.toISOString());
        if (counts.error || typeof counts.count !== 'number') return respond(res, 503);
        return respond(res, 200, {
          activeConsentedTabs: counts.count, checkedAt: now.toISOString(),
        });
      } catch { return respond(res, 503); }
    }
    return respond(res, 404);
  });
  return server;
}
async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function call(url, { op, tabToken, consent, bearer, origin, extra, site } = {}) {
  if (op) {
    const body = { op, tabToken, ...(op === 'leave' ? {} : { consent }), ...extra };
    return fetch(`${url}/api/presence/leases`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
        Origin: origin ?? url, 'Sec-Fetch-Site': site ?? 'same-origin',
      }, body: JSON.stringify(body),
    });
  }
  return fetch(`${url}/api/admin/presence/count`, {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
  });
}
async function count(url = rootA, bearer = adminToken) {
  const res = await call(url, { bearer });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ['activeConsentedTabs', 'checkedAt']);
  return body.activeConsentedTabs;
}

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  async function synthetic(role) {
    const created = await service.auth.admin.createUser({
      email: `pr344-http-${role}-${suffix}@example.invalid`,
      password, email_confirm: true,
    });
    assert.ifError(created.error);
    assert.ok(created.data.user?.id);
    return created.data.user;
  }
  const tech = await synthetic('technician');
  const admin = await synthetic('administrator');
  adminUserId = admin.id;
  const role = await service.from('pr344_http_synthetic_roles')
    .insert([{ user_id: tech.id, role: 'tecnico' }, { user_id: admin.id, role: 'admin' }]);
  assert.ifError(role.error);
  const loggedTech = await technician.auth.signInWithPassword({ email: tech.email, password });
  const loggedAdmin = await administrator.auth.signInWithPassword({ email: admin.email, password });
  assert.ifError(loggedTech.error);
  assert.ifError(loggedAdmin.error);
  techToken = loggedTech.data.session?.access_token ?? '';
  adminToken = loggedAdmin.data.session?.access_token ?? '';
  assert.ok(techToken && adminToken && techToken !== adminToken);
  serverA = makeServer();
  serverB = makeServer();
  [rootA, rootB] = await Promise.all([listen(serverA), listen(serverB)]);
  console.log('ISOLATION: two independent HTTP server instances and local synthetic Supabase Auth');
});
after(async () => {
  if (serverA) await new Promise(resolve => serverA.close(resolve));
  if (serverB) await new Promise(resolve => serverB.close(resolve));
});

test('L1: private table grants deny anonymous, technician and even admin direct rows', async () => {
  for (const client of [anonymous, technician, administrator]) {
    const result = await client.from('pr344_http_synthetic_leases').select('tab_hash').limit(1);
    assert.ok(result.error, 'browser client unexpectedly obtained private table access');
  }
  const serverResult = await service.from('pr344_http_synthetic_leases').select('tab_hash').limit(1);
  assert.ifError(serverResult.error);
  console.log('PASS L1: direct SELECT denied to all browser roles; service only');
});

test('L2: consent input, same-origin and strict body validation', async () => {
  at(0);
  assert.equal((await call(rootA, { op: 'start', tabToken: tab(), consent: false })).status, 400);
  assert.equal((await call(rootA, { op: 'start', tabToken: tab(), consent: true, origin: 'https://evil.invalid' })).status, 403);
  assert.equal((await call(rootA, { op: 'start', tabToken: tab(), consent: true, site: 'cross-site' })).status, 403);
  assert.equal((await call(rootA, { op: 'start', tabToken: 'short', consent: true })).status, 400);
  assert.equal((await call(rootA, { op: 'start', tabToken: tab(), consent: true, extra: { email: 'forbidden' } })).status, 400);
  assert.equal(await count(), 0);
  console.log('PASS L2: invalid/cross-origin/no-consent signals rejected, count unchanged');
});

test('L3: independent servers share unique active leases and admin-only count', async () => {
  at(300);
  const a = tab(), b = tab();
  assert.equal((await call(rootA, { op: 'start', tabToken: a, consent: true })).status, 204);
  assert.equal((await call(rootB, { op: 'start', tabToken: b, consent: true })).status, 204);
  assert.equal(await count(rootA), 2);
  assert.equal(await count(rootB), 2);
  assert.equal((await call(rootA)).status, 401);
  assert.equal((await call(rootA, { bearer: techToken })).status, 403);
  assert.equal((await call(rootA, { bearer: 'fake.invalid.token' })).status, 401);
  console.log('PASS L3: count shared across two instances; admin reads, others denied');
});

test('L4: concurrent beat is globally throttled; TTL excludes stale leases', async () => {
  at(600);
  const token = tab();
  assert.equal((await call(rootA, { op: 'start', tabToken: token, consent: true })).status, 204);
  at(625);
  const results = await Promise.all([
    call(rootA, { op: 'beat', tabToken: token, consent: true }),
    call(rootB, { op: 'beat', tabToken: token, consent: true }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [204, 429]);
  assert.equal(await count(), 1);
  at(701);
  assert.equal(await count(), 0);
  assert.equal((await call(rootA, { op: 'beat', tabToken: token, consent: true })).status, 410);
  console.log('PASS L4: atomic heartbeat rate limit, unique count, logical expiry');
});

test('L5: leave-before-start and concurrent revocation cannot revive a tab', async () => {
  at(900);
  const beforeStart = tab();
  assert.equal((await call(rootA, { op: 'leave', tabToken: beforeStart })).status, 204);
  assert.equal((await call(rootB, { op: 'start', tabToken: beforeStart, consent: true })).status, 410);
  const inFlight = tab();
  assert.equal((await call(rootA, { op: 'start', tabToken: inFlight, consent: true })).status, 204);
  at(925);
  const results = await Promise.all([
    call(rootB, { op: 'leave', tabToken: inFlight }),
    call(rootA, { op: 'beat', tabToken: inFlight, consent: true }),
  ]);
  assert.equal(results[0].status, 204);
  assert.ok([204, 410].includes(results[1].status), 'late beat must not reinsert a tombstone');
  assert.equal((await call(rootA, { op: 'start', tabToken: inFlight, consent: true })).status, 410);
  assert.equal(await count(), 0);
  const reconsent = tab();
  assert.equal((await call(rootA, { op: 'start', tabToken: reconsent, consent: true })).status, 204);
  assert.equal(await count(), 1);
  console.log('PASS L5: monotonic tombstones, race safety and new-consent epoch');
});

test('L6: shared network bucket limits synthetic burst across both hosts', async () => {
  at(1200);
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    statuses.push((await call(i % 2 ? rootB : rootA, {
      op: 'start', tabToken: tab(), consent: true,
    })).status);
  }
  assert.deepEqual(statuses, [204, 204, 204, 204, 204, 429]);
  assert.equal(await count(rootA), 5);
  assert.equal(await count(rootB), 5);
  console.log('PASS L6: 5 starts accepted, 6th rejected by shared budget');
});

test('L7: removing current admin role immediately revokes aggregate read', async () => {
  at(1500);
  assert.equal((await call(rootA, { bearer: adminToken })).status, 200);
  const revoke = await service.from('pr344_http_synthetic_roles')
    .delete().eq('user_id', adminUserId).eq('role', 'admin');
  assert.ifError(revoke.error);
  assert.equal((await call(rootB, { bearer: adminToken })).status, 403);
  const restore = await service.from('pr344_http_synthetic_roles')
    .insert({ user_id: adminUserId, role: 'admin' });
  assert.ifError(restore.error);
  assert.equal((await call(rootB, { bearer: adminToken })).status, 200);
  console.log('PASS L7: current server-side admin role, not stale JWT metadata');
});

test('L8: physical purge and fail-closed storage outage', async () => {
  at(1800);
  assert.equal(await count(), 0);
  const purge = await service.from('pr344_http_synthetic_leases')
    .delete().lte('purge_after', now.toISOString()).select('tab_hash');
  assert.ifError(purge.error);
  assert.ok(purge.data.length >= 1, 'expired synthetic leases should be physically purged');
  const remaining = await service.from('pr344_http_synthetic_leases')
    .select('tab_hash', { count: 'exact', head: true });
  assert.ifError(remaining.error);
  assert.equal(remaining.count, 0);
  storageUnavailable = true;
  try {
    assert.equal((await call(rootA, { op: 'start', tabToken: tab(), consent: true })).status, 503);
    assert.equal((await call(rootB, { bearer: adminToken })).status, 503);
  } finally { storageUnavailable = false; }
  console.log('PASS L8: explicit cleanup removes expired rows; unavailable never returns false zero');
});

test('L9: repeated start remains idempotent and spends only one quota slot', async () => {
  at(2100);
  const sameTab = tab();
  assert.equal((await call(rootA, { op: 'start', tabToken: sameTab, consent: true })).status, 204);
  for (let attempt = 0; attempt < 9; attempt++) {
    assert.equal((await call(attempt % 2 ? rootA : rootB, {
      op: 'start', tabToken: sameTab, consent: true,
    })).status, 204);
  }
  for (let fresh = 0; fresh < 4; fresh++) {
    assert.equal((await call(fresh % 2 ? rootB : rootA, {
      op: 'start', tabToken: tab(), consent: true,
    })).status, 204);
  }
  assert.equal((await call(rootB, { op: 'start', tabToken: tab(), consent: true })).status, 429);
  assert.equal(await count(rootA), 5);
  assert.equal(await count(rootB), 5);
  const bucketHash = digest(`bucket:127.0.0.1:${Math.floor(now.getTime() / 60000)}`);
  const budget = await service.from('pr344_http_synthetic_budgets')
    .select('used').eq('bucket_hash', bucketHash).single();
  assert.ifError(budget.error);
  assert.equal(budget.data.used, 5);
  at(2200);
  assert.equal((await call(rootA, { op: 'start', tabToken: sameTab, consent: true })).status, 410);
  console.log('PASS L9: nine retries did not spend quota; expired start cannot revive a lease');
});

test('L10: concurrent first starts from independent instances reserve only one slot', async () => {
  at(2400);
  const sharedTab = tab();
  const started = await Promise.all(Array.from({ length: 12 }, (_, i) =>
    call(i % 2 ? rootA : rootB, { op: 'start', tabToken: sharedTab, consent: true })));
  assert.ok(started.every((res) => res.status === 204));
  assert.equal(await count(rootA), 1);
  for (let fresh = 0; fresh < 4; fresh++) {
    assert.equal((await call(fresh % 2 ? rootB : rootA, {
      op: 'start', tabToken: tab(), consent: true,
    })).status, 204);
  }
  assert.equal((await call(rootB, { op: 'start', tabToken: tab(), consent: true })).status, 429);
  assert.equal(await count(rootB), 5);
  const bucketHash = digest(`bucket:127.0.0.1:${Math.floor(now.getTime() / 60000)}`);
  const budget = await service.from('pr344_http_synthetic_budgets')
    .select('used').eq('bucket_hash', bucketHash).single();
  assert.ifError(budget.error);
  assert.equal(budget.data.used, 5);
  console.log('PASS L10: twelve concurrent attempts for one tab charged once across both hosts');
});
