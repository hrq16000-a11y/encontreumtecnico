// Real GoTrue-issued sessions + PostgREST + existing audited RPC, all on 127.0.0.1.
// No hosted URL, credentials, technical records or private contacts are used.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { confirmedAdminTechnicianAction } from '../../../src/lib/admin-technician-action-confirmation.ts';

const local = '.github/qa/eut-admin-346';
const output = execFileSync('supabase', ['status', '-o', 'env'], {
  cwd: local, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
const values = Object.fromEntries(output.split(/\r?\n/).filter((line) => line.includes('='))
  .map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, '')];
  }));
const url = values.API_URL;
const anon = values.ANON_KEY;
const service = values.SERVICE_ROLE_KEY;
if (url !== 'http://127.0.0.1:54321' || !anon || !service)
  throw Error('Refusing nonlocal Supabase service or missing ephemeral keys');

const json = async (path, { key = anon, token = null, method = 'GET', body } = {}) => {
  const response = await fetch(url + path, {
    method,
    headers: {
      apikey: key, ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  let data = null;
  try { data = await response.json(); } catch { /* error body is not needed */ }
  return { status: response.status, data };
};

const createUser = async (email) => {
  const result = await json('/auth/v1/admin/users', {
    key: service, token: service, method: 'POST',
    body: { email, password: 'EUT_local_qa_only_346!', email_confirm: true },
  });
  if (![200, 201].includes(result.status) || !result.data?.id)
    throw Error(`Local user creation failed: ${result.status}`);
  return result.data.id;
};
const signIn = async (email) => {
  const result = await json('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password: 'EUT_local_qa_only_346!' },
  });
  if (result.status !== 200 || !result.data?.access_token)
    throw Error(`Local GoTrue sign-in failed: ${result.status}`);
  const user = await json('/auth/v1/user', { token: result.data.access_token });
  if (user.status !== 200 || user.data?.email !== email)
    throw Error('GoTrue did not verify the authenticated account');
  return result.data.access_token;
};

const nonce = randomUUID().slice(0, 8);
const adminEmail = `eut-admin-${nonce}@example.invalid`;
const regularEmail = `eut-member-${nonce}@example.invalid`;
const adminId = await createUser(adminEmail);
const technicianId = await createUser(regularEmail);
const adminToken = await signIn(adminEmail);
const regularToken = await signIn(regularEmail);
const recordId = randomUUID();

for (const id of [adminId, technicianId, recordId])
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw Error('Invalid isolated UUID');
execFileSync('psql', [
  '-X', '-v', 'ON_ERROR_STOP=1',
  '-v', `admin_id=${adminId}`, '-v', `tech_id=${technicianId}`,
  '-v', `record_id=${recordId}`, '-f', '.github/qa/eut-admin-346/seed.sql',
], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: {
  ...process.env, PGHOST: '127.0.0.1', PGPORT: '54322',
  PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: 'postgres',
} });

const readRecord = async () => {
  const r = await json(`/rest/v1/technicians?id=eq.${recordId}&select=id,status,display_name`,
    { key: service, token: service });
  if (r.status !== 200 || !Array.isArray(r.data) || r.data.length !== 1)
    throw Error(`Synthetic record read failed: ${r.status}`);
  return r.data[0];
};
const rpc = (token, action, value = {}, reason = 'Homologação sintética isolada 346') =>
  json('/rest/v1/rpc/eut_admin_technician_action', {
    token, method: 'POST', body: { p_id: recordId, p_action: action, p_value: value, p_reason: reason },
  });

const memberRead = await json(`/rest/v1/technicians?id=eq.${recordId}&select=id`, { token: regularToken });
if (memberRead.status !== 200 || memberRead.data?.length !== 0)
  throw Error('RLS allowed a nonadmin to read the synthetic record');
const deniedAnon = await rpc(null, 'aprovar');
const deniedMember = await rpc(regularToken, 'aprovar');
if (![401, 403].includes(deniedAnon.status) || ![401, 403].includes(deniedMember.status))
  throw Error('Unauthenticated or nonadmin RPC was not rejected');
if ((await readRecord()).status !== 'pendente') throw Error('Unauthorized action changed the record');

const cases = [
  ['aprovar', 'pendente', 'aprovado'],
  ['suspender', 'aprovado', 'suspenso'],
  ['reativar', 'suspenso', 'aprovado'],
  ['rejeitar', 'aprovado', 'rejeitado'],
  ['revisar', 'rejeitado', 'pendente'],
];
for (const [action, before, after] of cases) {
  if ((await readRecord()).status !== before) throw Error(`${action}: unexpected prior status`);
  const response = await rpc(adminToken, action);
  if (response.status !== 200 || !confirmedAdminTechnicianAction(
    response.data, recordId, action, before, 'Técnico sintético QA 346',
  )) throw Error(`${action}: authenticated RPC result disagrees with the UI confirmation`);
  if ((await readRecord()).status !== after) throw Error(`${action}: persisted status differs`);
  if (confirmedAdminTechnicianAction({ ...response.data, status: before }, recordId,
    action, before, 'Técnico sintético QA 346'))
    throw Error(`${action}: stale status was accepted`);
}

const edit = await rpc(adminToken, 'editar', {
  display_name: 'Técnico sintético corrigido QA 346',
  bio: 'Cadastro isolado.', region: 'Região sintética',
});
if (edit.status !== 200 || !confirmedAdminTechnicianAction(
  edit.data, recordId, 'editar', 'pendente', 'Técnico sintético corrigido QA 346',
)) throw Error('Authenticated editing was not confirmed');
const edited = await readRecord();
if (edited.display_name !== 'Técnico sintético corrigido QA 346' || edited.status !== 'pendente')
  throw Error('Editing changed status or failed persistence');
if (confirmedAdminTechnicianAction({ ...edit.data, id: randomUUID() }, recordId,
  'editar', 'pendente', 'Técnico sintético corrigido QA 346'))
  throw Error('Wrong identity was accepted');

for (const [action, reason] of [['invalid_action', 'Homologação isolada'], ['suspender', 'curto']]) {
  const rejected = await rpc(adminToken, action, {}, reason);
  if (rejected.status < 400) throw Error('Invalid admin request was accepted');
}
if ((await readRecord()).status !== 'pendente') throw Error('Negative case changed final status');

const audit = await json('/rest/v1/eut_admin_management_log?select=actor_id,target_key,action,reason,after_state&order=id.asc',
  { token: adminToken });
if (audit.status !== 200 || !Array.isArray(audit.data) || audit.data.length !== 6 ||
  audit.data.some((row) => row.actor_id !== adminId || row.target_key !== recordId ||
    row.action !== 'technician_update' || !row.reason.startsWith('Homologação sintética')))
  throw Error('Authenticated actions did not create six correctly attributed audit events');
const auditDenied = await json('/rest/v1/eut_admin_management_log?select=id&limit=1',
  { token: regularToken });
if (auditDenied.status !== 200 || auditDenied.data?.length !== 0)
  throw Error('RLS exposed audit records to nonadmin');

console.log('PASS: 2 GoTrue sessions; 5 real status transitions; 1 edit; 6 audit records; unauthorized/invalid actions denied; zero remote writes.');
