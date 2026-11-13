// Disposable Supabase CLI only: real GoTrue JWT + PostgREST + R1 SQL proposal.
// No production keys, network hosts, data, phone numbers, or user identities.
import assert from 'node:assert/strict';

const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env;
assert.match(API_URL ?? '', /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/);
assert.ok(ANON_KEY && SERVICE_ROLE_KEY, 'Missing disposable local keys');
const base = API_URL.replace(/\/$/, '');
const password = 'Synthetic-Only-R1-2026';

function headers(token, key = ANON_KEY, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function api(path, { method = 'GET', token = ANON_KEY,
  key = ANON_KEY, body, extra = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: headers(token, key, extra),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; }
  catch { throw new Error(`Invalid JSON from local ${path}: ${response.status}`); }
  return { status: response.status, data };
}

function success(result, label, expected = 200) {
  assert.equal(result.status, expected,
    `${label}: local HTTP ${result.status}, code=${result.data?.code ?? 'none'}`);
  return result.data;
}

async function rpc(name, token, args) {
  return api(`/rest/v1/rpc/${name}`, { method: 'POST', token, body: args });
}

async function makeUser(kind) {
  const email = `eut-r1-${kind}@example.invalid`;
  const user = success(await api('/auth/v1/admin/users', {
    method: 'POST', token: SERVICE_ROLE_KEY, key: SERVICE_ROLE_KEY,
    body: { email, password, email_confirm: true },
  }), `Create local ${kind}`);
  const id = user.user?.id ?? user.id;
  assert.match(id, /^[0-9a-f-]{36}$/i);
  const session = success(await api('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  }), `Login local ${kind}`);
  assert.equal(session.user?.id, id);
  assert.ok(session.access_token);
  success(await api('/rest/v1/user_roles', {
    method: 'POST', token: SERVICE_ROLE_KEY, key: SERVICE_ROLE_KEY,
    body: { user_id: id, role: kind },
  }), `Grant local ${kind}`, 201);
  return session.access_token;
}

const admin = await makeUser('admin');
const client = await makeUser('cliente');
const upsert = (args, token = admin) =>
  rpc('eut_admin_catalog_upsert', token, args);
const list = (token = admin, ids = undefined) =>
  rpc('eut_admin_catalog_list', token,
    { _page: 0, _limit: 20, _search: '', ...
      (ids === undefined ? {} : { _ids: ids }) });
const reason = 'Ação de QA no Supabase local descartável';

// Deny non-admin sessions before touching any catalog state.
const denied = await upsert({
  _origin: 'admin_manual', _source_key: 'qa:denied', _label: null,
  _city_ibge: null, _category_slug: null,
  _phone_input: '(41) 99999-1010', _reason: reason,
}, client);
assert.equal(denied.status, 403, 'A client executed the admin RPC');
assert.equal(denied.data?.code, '42501');
assert.notEqual((await list(client)).status, 200, 'A client listed private admin data');

// Only a phone, no invented name/city/category, enabled immediately and
// still legacy-pending: operational visibility != publication eligibility.
const first = success(await upsert({
  _origin: 'admin_manual', _source_key: 'qa:phone-only:001',
  _label: null, _city_ibge: null, _category_slug: null,
  _phone_input: '(41) 99999-1010', _reason: reason,
}), 'Admin create phone-only');
assert.equal(first.ok, true);
assert.equal(first.created, true);
assert.equal(first.catalog_enabled, true);
assert.equal(first.contact_available, true);
assert.equal(first.published, false);
assert.match(first.technician_id, /^[0-9a-f-]{36}$/i);

const byId = success(await list(admin, [first.technician_id]),
  'Admin catalog read');
assert.equal(byId.total, 1);
const phoneOnly = byId.rows[0];
assert.equal(phoneOnly.id, first.technician_id);
assert.equal(phoneOnly.display_name, null);
assert.equal(phoneOnly.city, null);
assert.equal(phoneOnly.legacy_status, 'pendente');
assert.equal(phoneOnly.catalog_enabled, true);
assert.equal(phoneOnly.has_private_contact, true);
assert.ok(phoneOnly.last_audit_id);
assert.ok(phoneOnly.updated_at);
assert.doesNotMatch(JSON.stringify(byId), /phone_e164|source_key|999991010/);

// A client cannot bypass the RPC to directly insert an Auth-less record.
const direct = await api('/rest/v1/technicians', {
  method: 'POST', token: client,
  body: { user_id: null, display_name: 'Bypass QA', status: 'pendente' },
});
assert.equal(direct.status, 403, 'Direct anonymous-owner insert bypassed RLS');
const anon = success(await api(
  `/rest/v1/technicians?select=id&id=eq.${first.technician_id}`),
  'Anonymous RLS read');
assert.deepEqual(anon, []);
const clientRead = success(await api(
  `/rest/v1/technicians?select=id&id=eq.${first.technician_id}`,
  { token: client }), 'Client RLS read');
assert.deepEqual(clientRead, []);
const privateRead = await api('/rest/v1/catalog_private_contacts?select=*',
  { token: client });
assert.notEqual(privateRead.status, 200,
  'Private contact table exposed in Data API');

// Import two synthetic contacts (including an entirely anonymous record).
const importRows = [
  { origin: 'external_import', source_key: 'qa:batch:001', label: null,
    city_ibge: null, category_slug: null, phone: '(41) 99999-2020' },
  { origin: 'external_import', source_key: 'qa:batch:002',
    label: 'Técnico Sintético', city_ibge: 4106902,
    category_slug: 'computadores', phone: null },
];
const imported = success(await rpc('eut_admin_catalog_import_batch', admin,
  { _rows: importRows, _reason: reason }), 'Batch import');
assert.equal(imported.processed, 2);
assert.deepEqual(imported.results.map(r => r.created), [true, true]);
assert.ok(imported.results.every(r => r.catalog_enabled === true));
assert.ok(imported.results.every(r => r.published === false));
const ids = imported.results.map(r => r.technician_id);
assert.equal(new Set([first.technician_id, ...ids]).size, 3);
const repeat = success(await rpc('eut_admin_catalog_import_batch', admin,
  { _rows: importRows, _reason: reason }), 'Idempotent batch import');
assert.deepEqual(repeat.results.map(r => r.technician_id), ids);
assert.deepEqual(repeat.results.map(r => r.created), [false, false]);

// Disable in a version-checked admin operation; then RELOAD through new API
// transactions, and re-import to prove a disabled contact stays disabled.
const importedBefore = success(await list(admin, ids), 'Read imported versions');
assert.equal(importedBefore.total, 2);
const target = importedBefore.rows.find(r => r.id === ids[0]);
assert.ok(target?.updated_at);
const disabled = success(await rpc('eut_admin_catalog_set_enabled', admin, {
  _id: target.id, _expected_updated_at: target.updated_at,
  _enabled: false, _reason: 'Desabilitação sintética auditada no runner',
}), 'Disable imported technician');
assert.equal(disabled.changed, true);
assert.equal(disabled.catalog_enabled, false);
const reloaded = success(await list(admin, [target.id]), 'Reload disabled');
assert.equal(reloaded.rows[0].catalog_enabled, false);
const reimported = success(await rpc('eut_admin_catalog_import_batch', admin,
  { _rows: importRows, _reason: reason }), 'Re-import after disable');
assert.deepEqual(reimported.results.map(r => r.technician_id), ids);
assert.equal(reimported.results[0].catalog_enabled, false);
const finalRead = success(await list(admin, [target.id]), 'Reload after re-import');
assert.equal(finalRead.rows[0].catalog_enabled, false);

// Existing ban list must stop a new imported phone, atomically.
const banned = await upsert({
  _origin: 'external_import', _source_key: 'qa:blocked:001',
  _label: null, _city_ibge: null, _category_slug: null,
  _phone_input: '(41) 99999-7070', _reason: reason,
});
assert.equal(banned.status, 403, 'Blocked phone was imported');
assert.equal(banned.data?.code, '42501');
const countAfterBan = success(await list(), 'Catalog read after denied import');
assert.equal(countAfterBan.total, 3);

// Audit rows are admin-visible, never contain private phone/source key.
const audit = success(await api(
  `/rest/v1/eut_admin_management_log?select=action,target_key,reason,before_state,after_state&target_key=eq.${target.id}`,
  { token: admin }), 'Admin audit read');
assert.ok(audit.some(e => e.action === 'catalog_created'));
assert.ok(audit.some(e => e.action === 'catalog_enabled_changed'));
assert.doesNotMatch(JSON.stringify(audit), /phone_e164|source_key|999992020/);
const auditClient = success(await api('/rest/v1/eut_admin_management_log?select=id',
  { token: client }), 'Client audit RLS');
assert.deepEqual(auditClient, []);

console.log('LOCAL_R1_API_OK: GoTrue JWT admin; phone-only create; private contact; batch import/idempotence; admin list; audited disable; HTTP reload; re-import preserves disable; bans and negative RLS');
console.log('LOCAL_R1_LIMIT: 6 Git migrations plus local-only shim; NOT hosted schema parity or public cutover');
