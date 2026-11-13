// Genuine local GoTrue/JWT negative QA after installing the eight legacy
// triggers and original RLS policy. All users, phones and hosts are synthetic.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const { API_URL, DB_URL, ANON_KEY, SERVICE_ROLE_KEY } = process.env;
assert.match(API_URL || '', /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/);
assert.match(DB_URL || '', /^postgres(?:ql)?:\/\/[^/]+@127\.0\.0\.1:\d+\/postgres$/);
assert.ok(ANON_KEY && SERVICE_ROLE_KEY);
const url = API_URL.replace(/\/$/, '');
const pass = 'Synthetic-Only-Local-Guard-2026';

async function request(path, token, method = 'GET', body, key = ANON_KEY) {
  const res = await fetch(url + path, {
    method,
    headers: {
      apikey: key, Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await res.text();
  return { status: res.status, data: response ? JSON.parse(response) : null };
}
function ok(result, label, status = 200) {
  assert.equal(result.status, status,
    label + ' HTTP ' + result.status + ' code=' + result.data?.code);
  return result.data;
}
const rpc = (name, token, body) =>
  request('/rest/v1/rpc/' + name, token, 'POST', body);
const reason = 'Auditoria de integração legada no runner sintético';

function onlyLocalSql(sql) {
  execFileSync('psql', [DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
  });
}

async function user(kind, role = kind) {
  const email = 'eut-legacy-' + kind + '@example.invalid';
  const created = await request('/auth/v1/admin/users', SERVICE_ROLE_KEY,
    'POST', { email, password: pass, email_confirm: true }, SERVICE_ROLE_KEY);
  assert.ok([200, 201].includes(created.status), 'Local GoTrue user creation');
  const id = created.data.user?.id ?? created.data.id;
  assert.match(id, /^[0-9a-f-]{36}$/i);
  const jwt = ok(await request('/auth/v1/token?grant_type=password', ANON_KEY,
    'POST', { email, password: pass }), 'Synthetic password login').access_token;
  assert.ok(jwt);
  ok(await request('/rest/v1/user_roles', SERVICE_ROLE_KEY, 'POST',
    { user_id: id, role }, SERVICE_ROLE_KEY), 'Synthetic role', 201);
  return { id, jwt };
}

const admin = await user('guards-admin', 'admin');
const blockedAdmin = await user('guards-blocked', 'admin');
const legacyTech = await user('guards-tech', 'tecnico');
onlyLocalSql("INSERT INTO eut_moderation.blocked_accounts(user_id,reason_internal) VALUES ('"
  + blockedAdmin.id + "','QA synthetic account lock')");

// R1 must still create/import without an Auth identity or confirmation.
const created = ok(await rpc('eut_admin_catalog_upsert', admin.jwt, {
  _origin: 'admin_manual', _source_key: 'qa:live-guards:001', _label: null,
  _city_ibge: null, _category_slug: null,
  _phone_input: '(41) 99999-6060', _reason: reason,
}), 'R1 Auth-less upsert under all legacy triggers');
assert.equal(created.created, true);
assert.equal(created.catalog_enabled, true);
const list = async () => ok(await rpc('eut_admin_catalog_list', admin.jwt,
  { _page: 0, _limit: 10, _search: '', _ids: [created.technician_id] }),
  'R1 admin list');
const before = (await list()).rows[0];
assert.equal(before.legacy_status, 'pendente');
assert.equal(before.display_name, null);

const edit = ok(await rpc('eut_admin_catalog_update', admin.jwt, {
  _id: before.id, _expected_updated_at: before.updated_at,
  _expected_audit_id: before.last_audit_id,
  _changes: { label: 'Técnico Local Integrado' }, _reason: reason,
}), 'R1 versioned edit under deployed audit trigger');
assert.equal(edit.changed, true);
const after = (await list()).rows[0];
assert.equal(after.display_name, 'Técnico Local Integrado');
assert.equal(after.last_audit_id, edit.last_audit_id);
assert.equal(after.catalog_enabled, true);
assert.equal(after.has_private_contact, true);
const audit = ok(await request('/rest/v1/eut_admin_management_log?select=action,reason,after_state&target_key=eq.'
  + before.id, admin.jwt), 'Legacy and catalog audit read');
assert.equal(audit.filter(x => x.action === 'technician_update').length, 1);
assert.equal(audit.filter(x => x.action === 'catalog_edited').length, 1);
assert.doesNotMatch(JSON.stringify(audit), /phone_e164|999996060|source_key/);
const stale = await rpc('eut_admin_catalog_update', admin.jwt, {
  _id: before.id, _expected_updated_at: before.updated_at,
  _expected_audit_id: before.last_audit_id,
  _changes: { label: 'Stale fake' }, _reason: reason,
});
assert.equal(stale.status, 409);
assert.equal(stale.data?.code, 'PT409');

// This spoofed URL is rejected by the COMPLETE installed trigger even if it
// escapes the local-only abbreviated text helper.
const directLeak = await request('/rest/v1/technicians?id=eq.' + before.id,
  admin.jwt, 'PATCH', { display_name: 'w w w . example . com' });
assert.equal(directLeak.data?.code, '23514',
  'Deployed public text trigger did not reject a disguised contact');
assert.equal((await list()).rows[0].display_name, 'Técnico Local Integrado');

// Operational blocks must reject admin RPCs, not merely hide the interface.
const ban = await rpc('eut_admin_catalog_upsert', blockedAdmin.jwt, {
  _origin: 'admin_manual', _source_key: 'qa:blocked-admin', _label: null,
  _city_ibge: null, _category_slug: null,
  _phone_input: '(41) 99999-5050', _reason: reason,
});
assert.equal(ban.status, 403);
assert.equal(ban.data?.code, '42501');
const banList = await rpc('eut_admin_catalog_list', blockedAdmin.jwt,
  { _page: 0, _limit: 5, _search: '' });
assert.equal(banList.status, 403);

// The original private Auth contact trigger must reject a blocked phone.
// This local-only SQL is a negative assertion with a private fixture; no
// contact or identity leaves the disposable container.
onlyLocalSql(
  "DO $check$ DECLARE denied boolean := false; BEGIN "
  + "BEGIN INSERT INTO public.eut_technician_private_contacts(user_id,phone_e164) "
  + "VALUES ('" + legacyTech.id + "','+5541999997070'); "
  + "EXCEPTION WHEN SQLSTATE 'P0001' THEN denied := true; END; "
  + "IF NOT denied THEN RAISE EXCEPTION 'Legacy private phone ban bypassed'; END IF; "
  + 'END $check$;'
);
console.log('LOCAL_R1_LEGACY_CORE_OK: 10 technician triggers, 1 private trigger, admin JWT CRUD, blocked RPC, disguised contact, dual audit and PT409');

// Explicitly test whether the verbatim permissive policy actually blocks an
// Auth-owned pending INSERT. A success here is a real RLS gap, NOT a green QA.
const blockedOwner = await request('/rest/v1/technicians', blockedAdmin.jwt,
  'POST', { user_id: blockedAdmin.id, display_name: 'Profissional QA Bloqueado',
    city: 'Curitiba', status: 'pendente' });
if (blockedOwner.status === 201) {
  console.error('LOCAL_R1_RLS_BLOCKER: blocked Auth owner inserted pending technician despite eut_new_technicians_not_restricted (permissive OR)');
  process.exitCode = 1;
} else {
  assert.equal(blockedOwner.data?.code, '42501',
    'Blocked Auth owner failed for a different reason');
  console.log('LOCAL_R1_BLOCKED_OWNER_OK: denied by RLS 42501');
}
