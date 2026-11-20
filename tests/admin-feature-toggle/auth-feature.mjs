// Contrato E2E no Auth local com duas contas sintéticas e JWT do GoTrue.
// A fixture simula o cadastro privado de proprietário; não simula OAuth Google.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

for (const [key, port] of [['API_URL','54321'],['DB_URL','54322']]) {
  const parsed = new URL(process.env[key] ?? '');
  assert(['127.0.0.1','localhost'].includes(parsed.hostname) && parsed.port===port,
    `${key}: conexões remotas proibidas`);
}
const base = process.env.API_URL;
const anon = process.env.ANON_KEY;
const service = process.env.SERVICE_ROLE_KEY;
assert(anon && service, 'Somente chaves efêmeras locais');
const ownerEmail = 'eut-feature-owner@example.invalid';
const otherEmail = 'eut-feature-other@example.invalid';
const password = 'EutFeatureOnly!2026';

function sql(source) {
  return execFileSync('psql', [process.env.DB_URL,'-X','-q','-v','ON_ERROR_STOP=1','-c',source],
    {encoding:'utf8',stdio:['ignore','pipe','pipe']});
}
async function api(path, token=anon, body) {
  const url = new URL(path, base);
  assert(url.origin===new URL(base).origin, 'Origin inesperada');
  const method = body === undefined ? 'GET' : 'POST';
  const response = await fetch(url,{method,headers:{apikey:token===service?service:anon,
    Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const raw=await response.text();
  let data;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}
  return {status:response.status,ok:response.ok,data};
}
function success(result,label) {
  assert(result.ok,`${label}: HTTP ${result.status}: ${JSON.stringify(result.data).slice(0,250)}`);
  return result.data;
}
async function denies(path,token,body,label) {
  const result=await api(path,token,body);
  assert(!result.ok,`${label}: acesso indevido concedido`);
  assert([400,401,403,404,409].includes(result.status),`${label}: HTTP ${result.status}`);
}
async function user(email) {
  const created=success(await api('/auth/v1/admin/users',service,
    {email,password,email_confirm:true}),'Criar conta local');
  const login=success(await api('/auth/v1/token?grant_type=password',anon,
    {email,password}),'Login legítimo');
  const jwt=JSON.parse(Buffer.from(login.access_token.split('.')[1],'base64url').toString('utf8'));
  assert.equal(jwt.sub,created.id);
  assert.match(jwt.session_id??'',/^[0-9a-f-]{36}$/i);
  return {id:created.id,token:login.access_token};
}

const owner=await user(ownerEmail);
const other=await user(otherEmail);
// A concessão de papéis/claim abaixo é APENAS uma fixture de PostgreSQL local.
sql(`INSERT INTO public.user_roles(user_id,role) VALUES
  ('${owner.id}','admin'),('${other.id}','admin');
  INSERT INTO eut_migration.project_owner_bootstrap
    (singleton,owner_email,claimed_user_id,claimed_at)
  VALUES (true,'${ownerEmail}','${owner.id}',now());`);
const read='/rest/v1/rpc/eut_home_public_proof_visible';
const write='/rest/v1/rpc/eut_admin_set_home_public_proof';
async function current() {return success(await api(read),'Ler flag pública');}
async function set(token,enabled,expected,reason) {
  return api(write,token,{_enabled:enabled,_expected_enabled:expected,_reason:reason});
}
assert.equal(await current(),true,'Estado inicial conserva o site atual');
await denies(write,anon,{_enabled:false,_expected_enabled:true,_reason:'Tentativa anônima'},
  'Anônimo não altera configurações');
await denies(write,other.token,{_enabled:false,_expected_enabled:true,_reason:'Outro admin não é proprietário'},
  'Admin não proprietário não altera');
await denies(write,owner.token,{_enabled:false,_expected_enabled:true,_reason:'curta'},
  'Justificativa curta não grava');
const first=success(await set(owner.token,false,true,'Pausar a prova social no teste local'),
  'Proprietário desabilita');
assert.equal(first.ok,true);
assert.equal(first.enabled,false);
assert.equal(await current(),false,'Leitura após escrita deve refletir o banco');
await denies(write,owner.token,{_enabled:true,_expected_enabled:true,
  _reason:'Tentativa de atualização com versão antiga'},'Precondição concorrente');
await denies(write,owner.token,{_enabled:false,_expected_enabled:false,
  _reason:'Não há mudança a registrar'},'Não registrar no-op');

// Uma conta bloqueada perde autorização mesmo com JWT válido.
sql(`INSERT INTO eut_moderation.blocked_accounts(user_id) VALUES ('${owner.id}')`);
await denies(write,owner.token,{_enabled:true,_expected_enabled:false,
  _reason:'Tentativa em conta bloqueada'},'Proprietário bloqueado');
sql(`DELETE FROM eut_moderation.blocked_accounts WHERE user_id='${owner.id}'`);
const second=success(await set(owner.token,true,false,'Restaurar a seção no teste local'),
  'Proprietário reabilita');
assert.equal(second.enabled,true);
assert.equal(await current(),true);

// Somente as duas mutações reais do proprietário podem ter auditoria.
sql(`DO $check$
BEGIN
  IF (SELECT COUNT(*) FROM eut_migration.admin_feature_flag_audit)<>2
    OR EXISTS (SELECT 1 FROM eut_migration.admin_feature_flag_audit
      WHERE actor_id<>'${owner.id}' OR session_id IS NULL
        OR old_enabled IS NOT DISTINCT FROM new_enabled)
    OR (SELECT enabled FROM eut_migration.admin_feature_flags
      WHERE flag_key='home_public_proof') IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'Auditoria ou estado final inválidos'; END IF;
  IF (SELECT relrowsecurity FROM pg_class
      WHERE oid='eut_migration.admin_feature_flags'::regclass) IS DISTINCT FROM true
    OR (SELECT relrowsecurity FROM pg_class
      WHERE oid='eut_migration.admin_feature_flag_audit'::regclass) IS DISTINCT FROM true
    OR has_schema_privilege('authenticated','eut_migration','USAGE')
    OR has_table_privilege('authenticated','eut_migration.admin_feature_flags','UPDATE')
    OR has_table_privilege('anon','eut_migration.admin_feature_flag_audit','SELECT')
    OR has_function_privilege('anon',
      'public.eut_admin_set_home_public_proof(boolean,boolean,text)','EXECUTE')
  THEN RAISE EXCEPTION 'RLS ou ACL privada vulnerável'; END IF;
END $check$;`);
// Rollback preserva prova/auditoria e revoga apenas a mutação futura.
execFileSync('psql',[process.env.DB_URL,'-X','-v','ON_ERROR_STOP=1',
  '-f','docs/sql/eut-admin-home-proof-toggle-rollback-20261120.sql'],
  {stdio:['ignore','pipe','pipe']});
sql(`DO $check$ BEGIN
  IF (SELECT COUNT(*) FROM eut_migration.admin_feature_flag_audit)<>2
    OR (SELECT COUNT(*) FROM eut_migration.admin_feature_flags)<>1
  THEN RAISE EXCEPTION 'Rollback apagou histórico'; END IF;
END $check$;`);
assert.equal(await current(),true,'Rollback mantém leitura pública anterior');
await denies(write,owner.token,{_enabled:false,_expected_enabled:true,
  _reason:'Depois do rollback nenhuma escrita'},'Rollback corta gravação');
console.log('PASS: flag persistida, proprietário exclusivo, auditoria, RLS, bloqueio, concorrência e rollback (localhost).');
