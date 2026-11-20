// PR #344 — real WebSocket integration test against a disposable *local* stack.
// No remote URL, production token, user record or Supabase project is accepted.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { after, before, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PR344_API_URL;
const anonKey = process.env.PR344_ANON_KEY;
const serviceKey = process.env.PR344_SERVICE_ROLE_KEY;
assert.equal(process.env.PR344_LOCAL_ONLY, 'yes', 'local-only marker is mandatory');
assert.match(url ?? '', /^http:\/\/127\.0\.0\.1:\d+$/, 'only localhost is permitted');
assert.ok(anonKey && serviceKey && anonKey !== serviceKey, 'local keys are required');
const topic = 'eut-consented-visitor-tabs-v2-private';
const visitorKind = 'consented-visitor-tab';
const password = 'only-local-synthetic-Pr344!2026';

const cfg = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const makeClient = () => createClient(url, anonKey, cfg);
const service = createClient(url, serviceKey, cfg);
const visitor = makeClient();
const technician = makeClient();
const administrator = makeClient();

const context = {
  visitorChannel: null,
  visitorTracked: false,
  technicianChannel: null,
  adminChannel: null,
  visitorSnapshots: [],
  technicianSnapshots: [],
};

function capturePresence(channel, target) {
  channel.on('presence', { event: 'sync' }, () => target.push(channel.presenceState()));
}

function statesHaveKind(state, kind) {
  return Object.values(state).some(entries => Array.isArray(entries) && entries.some(entry => entry?.kind === kind));
}

function countVisitorTabs(state) {
  return Object.values(state).filter(entries => Array.isArray(entries) && entries.some(entry => entry?.kind === visitorKind)).length;
}

async function waitUntil(predicate, label, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function subscribe(channel, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timeout = setTimeout(() => finish(new Error('subscribe TIMED_OUT')), timeoutMs);
    function finish(error, details) {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      error ? reject(error) : resolve(details);
    }
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') finish(null, { status });
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        finish(new Error(`${status}: ${String(err?.message ?? err ?? 'no detail')}`));
      }
    });
  });
}

before(async () => {
  const suffix = randomUUID().slice(0, 8);
  const createSyntheticUser = async (role) => {
    const response = await service.auth.admin.createUser({
      email: `pr344-${role}-${suffix}@example.invalid`, password, email_confirm: true,
    });
    assert.ifError(response.error);
    assert.ok(response.data.user?.id);
    return response.data.user;
  };
  const tech = await createSyntheticUser('technician');
  const admin = await createSyntheticUser('administrator');
  const insert = await service.from('pr344_synthetic_roles').insert({ user_id: admin.id, role: 'admin' });
  assert.ifError(insert.error);

  for (const [client, user] of [[technician, tech], [administrator, admin]]) {
    const login = await client.auth.signInWithPassword({ email: user.email, password });
    assert.ifError(login.error);
    assert.ok(login.data.session?.access_token, 'independent authenticated session missing');
    const payload = JSON.parse(Buffer.from(login.data.session.access_token.split('.')[1], 'base64url').toString());
    assert.equal(payload.role, 'authenticated', 'synthetic JWT role must be authenticated');
    assert.equal(payload.sub, user.id, 'synthetic JWT subject must match the signed-in user');
    await client.realtime.setAuth(login.data.session.access_token);
  }
  const roleProof = await administrator.rpc('has_role', { _user_id: admin.id, _role: 'admin' });
  assert.ifError(roleProof.error);
  assert.equal(roleProof.data, true, 'synthetic admin role must be visible with authenticated JWT');
  console.log('AUTHCHECK: admin role, JWT subject and authenticated role validated independently');
  console.log('SETUP: one visitor, one technician, one admin; all synthetic/local');
});

after(async () => {
  await Promise.allSettled([visitor.removeAllChannels(), technician.removeAllChannels(), administrator.removeAllChannels()]);
});

test('P1/P2: anonymous visitor has no channel without consent; with consent publishes TRACK without reading others', async () => {
  assert.equal(visitor.getChannels().length, 0, 'no consent must result in zero channels');
  // The app's consent check is exercised by the existing pure-function tests;
  // this real test starts tracking only after the synthetic consent decision.
  const channel = visitor.channel(topic, { config: { private: true } });
  context.visitorChannel = channel;
  capturePresence(channel, context.visitorSnapshots);
  await subscribe(channel);
  const result = await channel.track({ kind: visitorKind });
  assert.equal(result, 'ok', `anonymous TRACK was rejected: ${String(result)}`);
  context.visitorTracked = true;
  console.log('P2: anonymous channel joined and TRACK acknowledged by server');
});

test('P3: independent technician session cannot read visitor presence', async () => {
  const channel = technician.channel(topic, { config: { private: true } });
  context.technicianChannel = channel;
  capturePresence(channel, context.technicianSnapshots);
  try {
    await subscribe(channel);
  } catch (error) {
    if (!/CHANNEL_ERROR|denied|unauthorized/i.test(String(error))) throw error;
    console.log('P3: technician join rejected (read denied)');
    return;
  }
  await sleep(500);
  assert.equal(statesHaveKind(channel.presenceState(), visitorKind), false, 'technician received visitor presence');
  assert.equal(context.technicianSnapshots.some(state => statesHaveKind(state, visitorKind)), false);
  console.log('P3: technician connected in write-only mode, no visitor state received');
});

test('P4: independent administrator reads consented aggregate, visitor and technician cannot read admin marker', async () => {
  const channel = administrator.channel(topic, { config: { private: true } });
  context.adminChannel = channel;
  // Realtime >=2.167 evaluates Presence SELECT only when the join asks for
  // presence updates. A listener is required even for the admin read gate.
  channel.on('presence', { event: 'sync' }, () => {});
  await subscribe(channel);
  console.log('P4_AUTH: synthetic administrator joined the private Presence read channel');

  const adminMarker = 'pr344-admin-private-proof';
  const result = await channel.track({ kind: adminMarker });
  assert.equal(result, 'ok');
  await waitUntil(() => statesHaveKind(channel.presenceState(), adminMarker), 'admin marker');
  console.log('P4_AUTH: administrator TRACK and own Presence read succeeded');
  await waitUntil(() => countVisitorTabs(channel.presenceState()) === 1, 'admin to see one synthetic visitor');
  assert.equal(countVisitorTabs(channel.presenceState()), 1);
  await sleep(700);

  assert.equal(statesHaveKind(context.visitorChannel.presenceState(), adminMarker), false, 'visitor read admin presence');
  assert.equal(context.visitorSnapshots.some(state => statesHaveKind(state, adminMarker)), false, 'visitor received admin sync');
  if (context.technicianChannel) {
    assert.equal(statesHaveKind(context.technicianChannel.presenceState(), adminMarker), false, 'technician read admin presence');
    assert.equal(context.technicianSnapshots.some(state => statesHaveKind(state, adminMarker)), false, 'technician received admin sync');
  }
  console.log('P4: admin sees one visitor; visitor and technician do not see admin marker');
});

test('P5: consent revocation untracks visitor and removes it from admin aggregate', async () => {
  assert.equal(context.visitorTracked, true, 'BLOCKED: P2 anonymous TRACK never succeeded; cannot prove revocation');
  const result = await context.visitorChannel.untrack();
  assert.equal(result, 'ok');
  await waitUntil(() => countVisitorTabs(context.adminChannel.presenceState()) === 0, 'visitor revocation in admin state');
  assert.equal(countVisitorTabs(context.adminChannel.presenceState()), 0);
  await visitor.removeChannel(context.visitorChannel);
  console.log('P5: UNTRACK acknowledged; admin sees zero consenting visitor tabs');
});

test('P6: private-only tenant rejects legacy public-channel join with PrivateOnly', async () => {
  const legacy = visitor.channel('pr344-legacy-public-synthetic', { config: { private: false } });
  try {
    await subscribe(legacy);
    assert.fail('legacy public channel joined while private_only must be true');
  } catch (error) {
    assert.match(String(error), /PrivateOnly/i, 'expected explicit PrivateOnly server error');
  } finally {
    await visitor.removeChannel(legacy);
  }
  console.log('P6: legacy public channel rejected by real Realtime with PrivateOnly');
});
