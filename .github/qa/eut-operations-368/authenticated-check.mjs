// Nove cenarios com JWTs reais do GoTrue + RPC PostgREST, somente 127.0.0.1.
// As chaves de service_role sao usadas APENAS para criar usuarios ficticios.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const root = '.github/qa/eut-operations-368';
const raw = execFileSync('supabase', ['status', '-o', 'env'], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
const values = Object.fromEntries(raw.split(/\r?\n/).filter((line) => line.includes('='))
  .map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, '')];
  }));
const url = values.API_URL;
const anonKey = values.ANON_KEY;
const serviceKey = values.SERVICE_ROLE_KEY;
const dbUrl = new URL(values.DB_URL ?? '');
assert.equal(url, 'http://127.0.0.1:54321', 'API remota recusada');
assert(['127.0.0.1', 'localhost'].includes(dbUrl.hostname) && dbUrl.port === '54322',
  'PostgreSQL remoto recusado');
assert(anonKey && serviceKey, 'Chaves efemeras locais ausentes');

const dbEnv = { ...process.env, PGHOST: '127.0.0.1', PGPORT: '54322',
  PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: 'postgres' };
function sql(query) {
  return execFileSync('psql', ['-X', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: dbEnv,
  }).trim();
}
function uuid(value) {
  assert.match(value, /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i,
    'ID de fixture invalido');
  return value;
}
async function request(path, { method = 'GET', body, token = null, provision = false } = {}) {
  assert(path.startsWith('/'), 'Caminho nao local recusado');
  const response = await fetch(url + path, {
    method, headers: {
      apikey: provision ? serviceKey : anonKey,
      authorization: 'Bearer ' + (provision ? serviceKey : (token ?? anonKey)),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  let data = null;
  try { data = await response.json(); } catch { /* Resposta sem JSON. */ }
  return { status: response.status, data };
}
function success(result, label) {
  assert.equal(result.status, 200, label + ': HTTP ' + result.status);
  return result.data;
}
function rejectAuth(result, label) {
  assert([401, 403].includes(result.status),
    label + ': esperado bloqueio de autorizacao, HTTP ' + result.status);
}
function rejectInvalid(result, label) {
  assert([400, 422].includes(result.status),
    label + ': esperado erro de validacao, HTTP ' + result.status);
}
function rejectStale(result, label) {
  // SQLSTATE 40001 pode ser convertido em HTTP 500 pelo PostgREST local.
  assert([400, 409, 500].includes(result.status),
    label + ': esperada rejeicao de revisao, HTTP ' + result.status);
}
const rpc = (name, token, body = {}) =>
  request('/rest/v1/rpc/' + name, { method: 'POST', token, body });
const get = (token, id) => rpc('eut_technician_operations_get', token, { _technician_id: id });
const save = (token, id, payload, version = null, reason = null) =>
  rpc('eut_technician_operations_save', token, {
    _technician_id: id, _payload: payload,
    _expected_updated_at: version, _reason: reason,
  });

const password = 'EutOperationsCIOnly!368';
const nonce = randomUUID().slice(0, 8);
async function makeUser(kind) {
  const email = `eut-ops-${kind}-${nonce}@example.invalid`;
  const created = await request('/auth/v1/admin/users', {
    method: 'POST', provision: true,
    body: { email, password, email_confirm: true },
  });
  assert([200, 201].includes(created.status) && created.data?.id,
    kind + ': nao foi possivel criar usuario Auth local');
  const id = uuid(created.data.id);
  return { id, email };
}
async function login(user) {
  const result = success(await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email: user.email, password },
  }), 'Login Auth real');
  const token = result.access_token;
  assert(typeof token === 'string' && token.split('.').length === 3,
    'JWT assinado por GoTrue nao retornado');
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(claims.sub, user.id, 'JWT nao pertence a conta ficticia');
  assert.equal(claims.role, 'authenticated', 'JWT sem papel autenticado');
  const verified = success(await request('/auth/v1/user', { token }),
    'Validacao independente no Auth local');
  assert.equal(verified.id, user.id, 'Sessao GoTrue inconsistente');
  return token;
}

const [tech, admin, outsider, suspended] = await Promise.all(
  ['tech', 'admin', 'outsider', 'suspended'].map(makeUser));
const [techToken, adminToken, outsiderToken, suspendedToken] = await Promise.all(
  [tech, admin, outsider, suspended].map(login));
const techRecord = uuid(randomUUID());
const suspendedRecord1 = uuid(randomUUID());
const suspendedRecord2 = uuid(randomUUID());
sql(`
  INSERT INTO public.eut_ops_qa_roles(user_id,role) VALUES
    ('${tech.id}','tecnico'),('${admin.id}','admin'),
    ('${outsider.id}','cliente'),('${suspended.id}','tecnico');
  INSERT INTO public.technicians(id,user_id,status,coverage_city_ids,fixture_blocked) VALUES
    ('${techRecord}','${tech.id}','aprovado',ARRAY[4106902,4125506],false),
    ('${suspendedRecord1}','${suspended.id}','suspenso',ARRAY[4106902],true),
    ('${suspendedRecord2}','${suspended.id}','suspenso',ARRAY[4106902],true);
`);

const declared = {
  equipment: ['notebook', 'tools'], transport_mode: 'car', can_travel: true,
  service_windows: ['business', 'holiday'],
  eta_business_minutes: 90, eta_outside_minutes: null,
  free_city_ids: [4106902], paid_city_ids: [4125506],
  free_km: 10, km_threshold: 50, km_rate_cents: 250, km_rate_after_cents: 350,
};
const byAdmin = {
  ...declared, equipment: ['multimeter'], transport_mode: 'motorcycle',
  can_travel: false, service_windows: ['weekend'],
  eta_business_minutes: null, eta_outside_minutes: 60,
  paid_city_ids: [], free_km: 0, km_threshold: null,
  km_rate_cents: null, km_rate_after_cents: null,
};
const checked = [];
const mark = (name) => { checked.push(name); console.log('PASS ' + checked.length + ': ' + name); };

// 1. Leitura privada inicial.
const empty = success(await get(techToken, techRecord), 'Leitura inicial tecnica');
assert.equal(empty.ok, true);
assert.equal(empty.profile, null);
mark('tecnico autenticado le perfil vazio');

// 2. Gravar com token real de tecnico.
const initialSave = success(await save(techToken, techRecord, declared),
  'Gravacao inicial do titular');
assert.equal(initialSave.ok, true);
const ownerVersion = initialSave.updated_at;
assert(typeof ownerVersion === 'string' && ownerVersion.length > 10);
mark('titular grava todos os campos operacionais');

// 3. Nova sessao real relê a mesma versao, sem confiar na resposta do SAVE.
const refreshedTechToken = await login(tech);
const ownerRead = success(await get(refreshedTechToken, techRecord), 'Releitura titular');
assert.deepEqual(ownerRead.profile, declared);
assert.equal(ownerRead.updated_at, ownerVersion);
mark('nova sessao titular rele dados e revisao persistidos');

// 4. Admin le, nao pode salvar sem justificativa, salva e rele.
const adminRead = success(await get(adminToken, techRecord), 'Leitura administrativa');
assert.deepEqual(adminRead.profile, declared);
rejectInvalid(await save(adminToken, techRecord, byAdmin, ownerVersion),
  'Admin sem justificativa');
const adminSave = success(await save(adminToken, techRecord, byAdmin,
  ownerVersion, 'Ajuste administrativo sintético autorizado QA 368'),
  'Gravacao administrativa');
assert.equal(adminSave.ok, true);
const adminVersion = adminSave.updated_at;
const adminReread = success(await get(adminToken, techRecord), 'Releitura admin');
assert.deepEqual(adminReread.profile, byAdmin);
assert.equal(adminReread.updated_at, adminVersion);
mark('proprietario grava e rele com motivo auditavel');

// 5. Titular ve mudanca e escrita com versao antiga falha.
const afterAdmin = success(await get(refreshedTechToken, techRecord),
  'Titular relê alteracao administrativa');
assert.deepEqual(afterAdmin.profile, byAdmin);
rejectStale(await save(refreshedTechToken, techRecord, declared, ownerVersion),
  'Conflito otimista');
mark('titular relê alteracao e conflito de versao e negado');

// 6. Nenhum outro usuario ou visitante controla a ficha.
for (const [label, token] of [['terceiro', outsiderToken], ['anonimo', null]]) {
  rejectAuth(await get(token, techRecord), label + ' le privado');
  rejectAuth(await save(token, techRecord, declared), label + ' grava privado');
}
rejectAuth(await get(refreshedTechToken, suspendedRecord1), 'Titular le ficha alheia');
rejectAuth(await save(refreshedTechToken, suspendedRecord1, declared),
  'Titular grava ficha alheia');
mark('anonimo, terceiro e acesso cruzado negados');

// 7. Dois suspensos permanecem invisiveis e seus donos nao gravam.
rejectAuth(await save(suspendedToken, suspendedRecord1, declared),
  'Suspenso tenta gravar');
for (const id of [suspendedRecord1, suspendedRecord2]) {
  assert.equal(success(await rpc('eut_public_technician_operations', null,
    { _technician_id: id }), 'Projecao suspenso'), null);
}
assert.equal(sql(`SELECT count(*) FROM public.technicians WHERE status='suspenso'`), '2');
assert.equal(sql(`SELECT has_table_privilege('anon',
  'eut_profile_ops.technician_operations','SELECT') OR
  has_table_privilege('authenticated','eut_profile_ops.technician_operations','UPDATE')`),
  'f');
mark('suspensos protegidos e tabela privada sem grant direto');

// 8. A projecao publica e enum estrito, sem identidade ou contatos.
const projected = success(await rpc('eut_public_technician_operations', null,
  { _technician_id: techRecord }), 'Projecao anonima elegivel');
assert.deepEqual(projected, byAdmin);
assert.deepEqual(Object.keys(projected).sort(), Object.keys(declared).sort());
for (const privateKey of ['phone', 'phone_e164', 'email', 'user_id', 'status',
  'address', 'actor_id', 'reason', 'updated_at']) {
  assert(!(privateKey in projected), 'Campo privado exposto: ' + privateKey);
}
mark('projecao anonima somente campos explicitamente permitidos');

// 9. Integridade: extras, cidade fora da cobertura, repeticao e limites.
for (const malformed of [
  { ...byAdmin, phone: 'proibido' },
  { ...byAdmin, paid_city_ids: [3550308] },
  { ...byAdmin, equipment: ['notebook', 'notebook'] },
  { ...byAdmin, eta_outside_minutes: 2 },
]) {
  rejectInvalid(await save(refreshedTechToken, techRecord, malformed, adminVersion),
    'Payload invalido');
}
const untouched = success(await get(refreshedTechToken, techRecord),
  'Releitura final apos negativas');
assert.deepEqual(untouched.profile, byAdmin);
assert.equal(untouched.updated_at, adminVersion);
const counts = sql(`SELECT
  (SELECT count(*) FROM eut_profile_ops.technician_operations)::text || ',' ||
  (SELECT count(*) FROM public.eut_admin_management_log)::text || ',' ||
  (SELECT count(*) FROM public.technicians WHERE status='suspenso')::text`);
assert.equal(counts, '1,2,2', 'Escrita indevida no banco local');
const audit = success(await request(
  '/rest/v1/eut_admin_management_log?select=actor_id,action,reason,before_state,after_state&order=id.asc',
  { token: adminToken }), 'Auditoria autenticada');
assert.equal(audit.length, 2);
assert.equal(audit[0].actor_id, tech.id);
assert.equal(audit[1].actor_id, admin.id);
assert.equal(audit[0].action, 'technician_operations_self_updated');
assert.equal(audit[1].action, 'technician_operations_admin_updated');
assert.deepEqual(audit[1].before_state, declared);
assert.deepEqual(audit[1].after_state, byAdmin);
const deniedAudit = success(await request(
  '/rest/v1/eut_admin_management_log?select=id&limit=1',
  { token: outsiderToken }), 'Auditoria privada de terceiros');
assert.deepEqual(deniedAudit, []);
mark('payloads invalidos rejeitados; auditoria e estado preservados');

assert.equal(checked.length, 9);
console.log('PASS FINAL: 9/9 cenarios autenticados com GoTrue + PostgREST locais; zero acesso oficial.');
