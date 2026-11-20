// E2E autenticado, sem dependências externas: só GoTrue, PostgREST, Mailpit
// e PostgreSQL locais. NUNCA usa dados ou credenciais do Supabase oficial.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const apiUrl = new URL(process.env.API_URL ?? '');
const dbUrl = new URL(process.env.DB_URL ?? '');
for (const [url, port] of [[apiUrl, '54321'], [dbUrl, '54322']]) {
  assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === port,
    'Conexão não local recusada');
}
const anonKey = process.env.ANON_KEY;
const serviceKey = process.env.SERVICE_ROLE_KEY;
assert(anonKey && serviceKey, 'Apenas chaves efêmeras do stack local');

const ownerEmail = 'eut-otp-ci-owner@example.invalid';
const otherEmail = 'eut-otp-ci-other@example.invalid';
const password = 'EutCiOnly!Pass2026';
const mailpitUrl = 'http://127.0.0.1:54324';

async function request(path, { method = 'GET', body, token = anonKey } = {}) {
  const url = new URL(path, apiUrl);
  assert(url.origin === apiUrl.origin, 'API remota recusada');
  const response = await fetch(url, {
    method,
    headers: {
      apikey: token === serviceKey ? serviceKey : anonKey,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: response.status, data, ok: response.ok };
}

function successful(result, context) {
  assert(result.ok, `${context}: HTTP ${result.status}, ${JSON.stringify(result.data).slice(0, 350)}`);
  return result.data;
}

async function rejected(path, options, context) {
  const result = await request(path, options);
  assert(!result.ok, `${context}: acesso indevido aceito (HTTP ${result.status})`);
  assert([400, 401, 403, 404].includes(result.status),
    `${context}: rejeição inesperada HTTP ${result.status}`);
}

async function rpc(name, token, body = {}) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', body, token });
}

function psql(sql) {
  return execFileSync('psql', [process.env.DB_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function jwtClaims(token) {
  const parts = token.split('.');
  assert(parts.length === 3, 'JWT real de GoTrue obrigatório');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

async function makeUser(email, role) {
  const user = successful(await request('/auth/v1/admin/users', {
    method: 'POST', token: serviceKey,
    body: { email, password, email_confirm: true },
  }), 'Criar usuário fictício no Auth local');
  assert.match(user.id, /^[0-9a-f-]{36}$/i);
  const login = successful(await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  }), 'Login de senha Auth local');
  assert.equal(jwtClaims(login.access_token).sub, user.id);
  successful(await rpc('choose_account_type', login.access_token, { _role: role }),
    'Atribuir papel legítimo no banco local');
  return { id: user.id, token: login.access_token };
}

async function mailpitMagicLink() {
  let email;
  for (let attempt = 0; attempt < 25; attempt++) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages`);
    assert(response.ok, `Mailpit local indisponível: HTTP ${response.status}`);
    const list = await response.json();
    const matches = (list.messages ?? []).filter(message =>
      JSON.stringify(message.To ?? []).toLowerCase().includes(ownerEmail));
    if (matches.length) {
      const id = matches[0].ID;
      assert(id, 'Mailpit não retornou ID da mensagem');
      const detail = await fetch(`${mailpitUrl}/api/v1/message/${encodeURIComponent(id)}`);
      assert(detail.ok, 'Falha na leitura de e-mail do Mailpit');
      email = await detail.json();
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert(email, 'O GoTrue local não entregou e-mail OTP ao Mailpit');
  const text = `${email.Text ?? ''}\n${email.HTML ?? ''}`.replaceAll('&amp;', '&');
  const urls = text.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  for (const raw of urls) {
    try {
      const candidate = new URL(raw.replace(/[),.;]+$/, ''));
      if (['127.0.0.1', 'localhost'].includes(candidate.hostname)
        && candidate.port === '54321'
        && candidate.pathname === '/auth/v1/verify') return candidate;
    } catch { /* Links do template que não são URLs completas. */ }
  }
  throw new Error('Mensagem do Mailpit sem link de verificação do Auth local');
}

async function accessTokenFromLink(link) {
  const response = await fetch(link, { redirect: 'manual' });
  assert([302, 303].includes(response.status),
    `Verificação do link OTP não redirecionou: HTTP ${response.status}`);
  const location = response.headers.get('location');
  assert(location, 'GoTrue não devolveu redirect de sessão');
  const redirect = new URL(location, link);
  const token = new URLSearchParams(redirect.hash.slice(1)).get('access_token');
  assert(token, 'Link verificado sem access_token Auth legítimo');
  return token;
}

function assertPrivateProof(userId, email) {
  psql(`
    DO $check$
    DECLARE v_user uuid := '${userId}';
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM eut_migration.technician_email_otp_proofs
        WHERE user_id=v_user AND verified_email='${email}'
          AND proof_method IN ('otp','magiclink') AND revoked_at IS NULL
      ) THEN RAISE EXCEPTION 'prova OTP privada não persistida'; END IF;
      IF EXISTS (SELECT 1 FROM eut_migration.technician_email_otp_challenges
                 WHERE user_id=v_user)
      THEN RAISE EXCEPTION 'desafio não foi consumido'; END IF;
      IF (SELECT relrowsecurity FROM pg_class
          WHERE oid='eut_migration.technician_email_otp_proofs'::regclass) IS DISTINCT FROM true
      THEN RAISE EXCEPTION 'RLS desativada'; END IF;
      IF has_schema_privilege('authenticated','eut_migration','USAGE')
        OR has_table_privilege('authenticated',
             'eut_migration.technician_email_otp_proofs','SELECT')
        OR has_table_privilege('anon',
             'eut_migration.technician_email_otp_proofs','SELECT')
        OR has_function_privilege('anon','public.eut_attest_technician_email_otp()','EXECUTE')
      THEN RAISE EXCEPTION 'exposição de prova privada'; END IF;
      PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
      IF eut_migration.confirmed_current_email() IS DISTINCT FROM '${email}'
      THEN RAISE EXCEPTION 'contrato não reconheceu OTP após atestação'; END IF;
    END;
    $check$;
  `);
}

const owner = await makeUser(ownerEmail, 'tecnico');
const other = await makeUser(otherEmail, 'cliente');

// Reproduz precisamente a condição das contas legítimas bloqueadas: o
// e-mail autoconfirmado por administração não é, sozinho, prova de titularidade.
psql(`DO $check$ BEGIN
  PERFORM set_config('request.jwt.claim.sub','${owner.id}',true);
  IF eut_migration.confirmed_current_email() IS NOT NULL
  THEN RAISE EXCEPTION 'fixture já possuía confirmação legítima antes do OTP'; END IF;
END $check$;`);

// Sem sessão técnica, sem link, ou com sessão comum: fail closed.
await rejected('/rest/v1/rpc/eut_attest_technician_email_otp',
  { method: 'POST', body: {} }, 'Anônimo não pode atestar');
await rejected('/rest/v1/rpc/eut_begin_technician_email_otp',
  { method: 'POST', body: {} }, 'Anônimo não pode iniciar');
await rejected('/rest/v1/rpc/eut_attest_technician_email_otp',
  { method: 'POST', body: {}, token: other.token }, 'Outra conta não pode atestar');
await rejected('/rest/v1/rpc/eut_attest_technician_email_otp',
  { method: 'POST', body: {}, token: owner.token }, 'Senha não comprova OTP');

assert.deepEqual(successful(await rpc('eut_begin_technician_email_otp', owner.token),
  'Desafio pré-envio'), { ok: true });
const sent = successful(await request('/auth/v1/otp', {
  method: 'POST', body: { email: ownerEmail, create_user: false },
}), 'GoTrue deve enviar magiclink real');
assert(!sent?.access_token, 'OTP não pode emitir JWT sem verificar link');
await rejected('/rest/v1/rpc/eut_attest_technician_email_otp',
  { method: 'POST', body: {}, token: owner.token }, 'Sessão de senha não prova link enviado');

const verifiedToken = await accessTokenFromLink(await mailpitMagicLink());
const claims = jwtClaims(verifiedToken);
assert.equal(claims.sub, owner.id, 'Link não pertence à conta técnica');
assert.match(claims.session_id ?? '', /^[0-9a-f-]{36}$/i);
assert((claims.amr ?? []).some(item => ['otp','magiclink'].includes(item.method)),
  'O Auth local não assinou método OTP/magiclink no JWT');

assert.deepEqual(successful(await rpc('eut_attest_technician_email_otp', verifiedToken),
  'Atestação real após clique no e-mail'), { ok: true, verified: true });
assertPrivateProof(owner.id, ownerEmail);

await rejected('/rest/v1/rpc/eut_attest_technician_email_otp',
  { method: 'POST', body: {}, token: verifiedToken }, 'Reuso de desafio já consumido');

// Bloqueio atua também sobre uma prova existente; apenas conta sintética.
psql(`INSERT INTO eut_moderation.blocked_accounts(user_id) VALUES ('${owner.id}')`);
await rejected('/rest/v1/rpc/eut_begin_technician_email_otp',
  { method: 'POST', body: {}, token: verifiedToken }, 'Conta bloqueada não inicia OTP');
psql(`DELETE FROM eut_moderation.blocked_accounts WHERE user_id='${owner.id}'`);

// Modificar somente o e-mail sintético verifica revogação sem tocar terceiros.
psql(`UPDATE auth.users SET email='eut-otp-ci-owner-changed@example.invalid'
      WHERE id='${owner.id}'`);
psql(`DO $check$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM eut_migration.technician_email_otp_proofs
    WHERE user_id='${owner.id}' AND revoked_at IS NOT NULL)
  THEN RAISE EXCEPTION 'mudança de e-mail não revogou a prova'; END IF;
END $check$;`);

console.log('PASS: OTP Auth real, Mailpit, prova privada, replay, RLS, bloqueio e revogação (100% localhost).');
