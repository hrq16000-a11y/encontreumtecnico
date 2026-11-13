// Disposable Supabase ONLY: real GoTrue JWT, local R1+R2 and synthetic WordPress.
// Never pass hosted URLs, external keys, personal data or a payment token.
import assert from 'node:assert/strict';

const { API_URL, DB_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env;
assert.match(API_URL || '', /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/);
assert.match(DB_URL || '', /^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:\d+\/postgres$/);
assert.ok(ANON_KEY && SERVICE_ROLE_KEY);

async function api(path, token = ANON_KEY, method = 'GET', body, key = ANON_KEY) {
  const response = await fetch(API_URL.replace(/\/$/, '') + path, {
    method,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  return { status: response.status, data: raw ? JSON.parse(raw) : null };
}

function ok(result, label, expected = 200) {
  assert.equal(result.status, expected,
    label + ' HTTP ' + result.status + ' code=' + result.data?.code);
  return result.data;
}

const accountCreated = await api('/auth/v1/admin/users', SERVICE_ROLE_KEY,
  'POST', { email: 'eut-wordpress-local-admin@example.invalid',
    password: 'Synthetic-Only-WP-Catalog-2026', email_confirm: true },
  SERVICE_ROLE_KEY);
assert.ok([200, 201].includes(accountCreated.status),
  'Local synthetic administrator HTTP ' + accountCreated.status);
const account = accountCreated.data;
const adminId = account.user?.id ?? account.id;
assert.match(adminId, /^[0-9a-f-]{36}$/i);
const adminJwt = ok(await api('/auth/v1/token?grant_type=password', ANON_KEY,
  'POST', { email: 'eut-wordpress-local-admin@example.invalid',
    password: 'Synthetic-Only-WP-Catalog-2026' }),
  'Local administrator session').access_token;
ok(await api('/rest/v1/user_roles', SERVICE_ROLE_KEY, 'POST',
  { user_id: adminId, role: 'admin' }, SERVICE_ROLE_KEY),
  'Local admin role', 201);

const reason = 'Catálogo WordPress sintético sem reivindicação';
const upsert = (source, phone) => api('/rest/v1/rpc/eut_admin_catalog_upsert',
  adminJwt, 'POST', {
    _origin: 'wordpress', _source_key: source, _label: 'apelidolegacy',
    _city_ibge: null, _category_slug: null, _phone_input: phone,
    _reason: reason,
  });
const eligible = ok(await upsert('wp:synthetic:has-phone', '(41) 99999-8181'),
  'Import WP with private phone');
const noPhone = ok(await upsert('wp:synthetic:no-phone', null),
  'Import WP without private phone');
assert.equal(eligible.created, true);
assert.equal(eligible.catalog_enabled, true);
assert.equal(eligible.contact_available, true);
assert.equal(noPhone.created, true);
assert.equal(noPhone.catalog_enabled, true);
assert.equal(noPhone.contact_available, false);
assert.notEqual(eligible.technician_id, noPhone.technician_id);

const publicRead = async (id) => ok(await api('/rest/v1/technicians?select='
  + 'id,user_id,display_name,city,ddd_hint,catalog_enabled&id=eq.' + id),
  'Anonymous public technician read');
const visible = await publicRead(eligible.technician_id);
assert.equal(visible.length, 1, 'Phone-backed unclaimed WP profile must be visible');
assert.equal(visible[0].user_id, null, 'WP import created an Auth owner');
assert.equal(visible[0].display_name, 'apelidolegacy');
assert.equal(visible[0].city, null, 'DDD was invented as municipality');
assert.equal(String(visible[0].ddd_hint), '41', 'Regional DDD hint was lost');
assert.deepEqual(await publicRead(noPhone.technician_id), [],
  'Phone-less WP profile appeared in public offer');

const ids = [eligible.technician_id, noPhone.technician_id];
const candidates = ok(await api('/rest/v1/rpc/eut_public_eligible_technician_ids',
  ANON_KEY, 'POST', { _ids: ids }), 'Anonymous R2 candidate RPC');
assert.deepEqual(candidates.map(row => row.technician_id),
  [eligible.technician_id], 'R2 offered a phone-less or missed a valid WP profile');
const privateRead = await api('/rest/v1/catalog_private_contacts?select=*');
assert.notEqual(privateRead.status, 200,
  'Private contacts were exposed in public PostgREST schema');
console.log('LOCAL_WP_AUTHLESS_VISIBLE_OK: valid phone, alias, DDD-only hint, zero Auth, private contact');
console.log('LOCAL_WP_NO_PHONE_HIDDEN_OK: unavailable private contact is never offered');

const adminList = ok(await api('/rest/v1/rpc/eut_admin_catalog_list',
  adminJwt, 'POST', { _page: 0, _limit: 10, _search: '',
    _ids: [eligible.technician_id] }), 'Versioned admin list');
const before = adminList.rows[0];
assert.ok(before?.updated_at);
const disabled = ok(await api('/rest/v1/rpc/eut_admin_catalog_set_enabled',
  adminJwt, 'POST', { _id: eligible.technician_id,
    _expected_updated_at: before.updated_at, _enabled: false, _reason: reason }),
  'Disable WP catalog record');
assert.equal(disabled.catalog_enabled, false);
assert.deepEqual(await publicRead(eligible.technician_id), [],
  'Disabled WP profile remained publicly visible');
const replay = ok(await upsert('wp:synthetic:has-phone', '(41) 99999-8181'),
  'Idempotent WP re-import');
assert.equal(replay.technician_id, eligible.technician_id);
assert.equal(replay.created, false);
assert.equal(replay.catalog_enabled, false);
assert.deepEqual(await publicRead(eligible.technician_id), [],
  'Re-import silently re-enabled disabled WP profile');
console.log('LOCAL_WP_DISABLE_RELOAD_OK: audited disable, invisible after reimport, unchanged identity');
