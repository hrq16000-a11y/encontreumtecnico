// EUT P0 — única prova E2E nova: publicação, releitura e nova sessão.
// Supabase Auth/GoTrue + PostgREST reais, 100% localhost, dados sintéticos.
// Nunca aceita URL ou chave do Supabase EUT oficial; nunca imprime JWTs.
import assert from 'node:assert/strict';

const api = new URL(process.env.API_URL ?? '');
const db = new URL(process.env.DB_URL ?? '');
for (const [url, port] of [[api, '54321'], [db, '54322']]) {
  assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === port,
    'FAIL CLOSED: somente stack Supabase local nas portas esperadas');
}
const anon = process.env.ANON_KEY;
const localService = process.env.SERVICE_ROLE_KEY;
assert(anon && localService, 'Chaves efêmeras locais obrigatórias');
const email = 'eut-p0-persist-owner@example.invalid';
const password = 'EutLocalOnly-P0!2026';

async function http(path, { method = 'GET', body, token } = {}) {
  const url = new URL(path, api);
  assert(url.origin === api.origin, 'Endereço remoto recusado');
  const response = await fetch(url, {
    method,
    headers: {
      apikey: token === localService ? localService : anon,
      Authorization: `Bearer ${token ?? anon}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  return { ok: response.ok, status: response.status, data };
}

function ok(result, label) {
  assert(result.ok, `${label} falhou: HTTP ${result.status}`);
  return result.data;
}
function claimSubject(token) {
  const pieces = token.split('.');
  assert.equal(pieces.length, 3, 'JWT real do Auth local obrigatório');
  return JSON.parse(Buffer.from(pieces[1], 'base64url').toString('utf8')).sub;
}
async function signIn() {
  const session = ok(await http('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  }), 'Login Auth real');
  assert(session.access_token, 'GoTrue não retornou sessão');
  return session.access_token;
}
async function profile(token, owner) {
  const query = new URLSearchParams({
    select: 'id,user_id,status,display_name,state_uf,city,neighborhood,region,bio,specialties,service_slugs',
    user_id: `eq.${owner}`,
  });
  const rows = ok(await http(`/rest/v1/technicians?${query}`, { token }), 'Releitura PostgREST');
  assert(Array.isArray(rows), 'Resposta não é uma lista');
  return rows;
}
function samePublished(row, expected, owner, id) {
  assert.equal(row.user_id, owner, 'Titular mudou');
  assert.equal(row.id, id, 'Identificador mudou');
  assert.equal(row.status, 'aprovado', 'Status não persistiu');
  for (const key of ['display_name','state_uf','city','neighborhood','region','bio']) {
    assert.equal(row[key], expected['_' + key] ?? null, `Campo ${key} não persistiu`);
  }
  assert.deepEqual([...row.specialties].sort(), [...expected._specialties].sort());
  assert.deepEqual([...row.service_slugs].sort(), [...expected._service_slugs].sort());
}

const created = ok(await http('/auth/v1/admin/users', {
  method: 'POST', token: localService,
  body: { email, password, email_confirm: true },
}), 'Conta sintética em Auth local');
assert.match(created.id, /^[0-9a-f-]{36}$/i);
const owner = created.id;
const token1 = await signIn();
assert.equal(claimSubject(token1), owner);
ok(await http('/rest/v1/rpc/choose_account_type', {
  method: 'POST', token: token1, body: { _role: 'tecnico' },
}), 'Escolha de papel técnico pelo servidor');
assert.equal((await profile(token1, owner)).length, 0, 'Cadastro não começou vazio');

const initial = {
  _display_name: 'Técnico Sintético P0',
  _state_uf: 'PR',
  _city: 'Curitiba',
  _neighborhood: 'Centro',
  _region: 'Curitiba',
  _bio: 'Formatação e suporte em informática.',
  _specialties: ['informatica'],
  _service_slugs: ['formatacao'],
};
const result = ok(await http('/rest/v1/rpc/eut_publish_my_technician', {
  method: 'POST', token: token1, body: initial,
}), 'Publicação via RPC exata');
assert.equal(result.state, 'publicado');
assert.match(result.technician_id, /^[0-9a-f-]{36}$/i);
const first = await profile(token1, owner);
assert.equal(first.length, 1, 'Publicação não criou ficha única');
samePublished(first[0], initial, owner, result.technician_id);

// Nova sessão real, sem reaproveitar o JWT anterior ou o estado da aplicação.
const token2 = await signIn();
assert.equal(claimSubject(token2), owner);
assert.notEqual(token2, token1, 'Não foi emitida uma nova sessão');
const afterLogin = await profile(token2, owner);
assert.equal(afterLogin.length, 1, 'Ficha desapareceu ao renovar sessão');
samePublished(afterLogin[0], initial, owner, result.technician_id);

// Segunda publicação pela mesma conta deve EDITAR, sem duplicação.
const updated = {
  ...initial,
  _display_name: 'Técnico Sintético Atualizado',
  _bio: 'Formatação, redes e manutenção autorizada.',
  _specialties: ['informatica', 'redes'],
  _service_slugs: ['formatacao', 'wifi'],
};
const changed = ok(await http('/rest/v1/rpc/eut_publish_my_technician', {
  method: 'POST', token: token2, body: updated,
}), 'Atualização via mesma RPC');
assert.equal(changed.state, 'publicado');
assert.equal(changed.technician_id, result.technician_id);
const finalRows = await profile(token2, owner);
assert.equal(finalRows.length, 1, 'Atualização duplicou a ficha');
samePublished(finalRows[0], updated, owner, result.technician_id);

console.log('PASS P0 local: papel legítimo, publicação, releitura, nova sessão, atualização e ID estável.');
