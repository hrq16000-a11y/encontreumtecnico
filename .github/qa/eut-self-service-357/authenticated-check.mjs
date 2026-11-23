// Homologacao real GoTrue + PostgREST + PostgreSQL, apenas localhost.
// Nao usa service_role no frontend, nao le o Supabase oficial, zero dados reais.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = '.github/qa/eut-self-service-357';
const result = execFileSync('supabase', ['status', '-o', 'env'], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
const vars = Object.fromEntries(result.split(/\r?\n/).filter((line) => line.includes('='))
  .map((line) => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')];
  }));
const api = vars.API_URL;
const anon = vars.ANON_KEY;
const service = vars.SERVICE_ROLE_KEY;
const db = vars.DB_URL;
if (api !== 'http://127.0.0.1:54321' || !anon || !service ||
  !['127.0.0.1', 'localhost'].includes(new URL(db).hostname) || new URL(db).port !== '54322') {
  throw Error('NO-GO: endpoint ou chave efemera nao aponta para Supabase localhost');
}

const request = async (path, { token = null, key = anon, method = 'GET', body } = {}) => {
  const response = await fetch(api + path, {
    method,
    headers: { apikey: key, ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(14000),
  });
  let data = null;
  try { data = await response.json(); } catch { /* response may be empty */ }
  return { status: response.status, data };
};

const sql = (statement) => execFileSync('psql', ['-X','-tA','-v','ON_ERROR_STOP=1','-c',statement], {
  env: { ...process.env, PGHOST: '127.0.0.1', PGPORT: '54322',
    PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: 'postgres' },
  encoding: 'utf8', stdio: ['ignore','pipe','pipe'],
}).trim();
const psqlFile = (file, names = {}) => {
  const args = ['-X','-v','ON_ERROR_STOP=1'];
  for (const [name,value] of Object.entries(names)) args.push('-v', `${name}=${value}`);
  args.push('-f', file);
  return execFileSync('psql', args, {
    env: { ...process.env, PGHOST: '127.0.0.1', PGPORT: '54322',
      PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: 'postgres' },
    encoding: 'utf8', stdio: ['ignore','pipe','pipe'],
  });
};
const ensure = (yes, reason) => { if (!yes) throw Error(`NO-GO: ${reason}`); };
const uuid = (id) => {
  ensure(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id), 'invalid synthetic UUID');
  return id;
};
const nonce = randomUUID().slice(0, 8);
const password = 'EUT_QA_357_local_Only!';
const names = ['owner','other','suspended','rejected','blocked','client','admin'];
const users = {};
for (const name of names) {
  const email = `eut-357-${name}-${nonce}@example.invalid`;
  const created = await request('/auth/v1/admin/users', {
    key: service, token: service, method: 'POST',
    body: { email, password, email_confirm: true },
  });
  ensure([200,201].includes(created.status), `local Auth failed to create ${name}`);
  const loggedIn = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  });
  ensure(loggedIn.status === 200 && loggedIn.data?.access_token, `local Auth failed to sign in ${name}`);
  const who = await request('/auth/v1/user', { token: loggedIn.data.access_token });
  ensure(who.status === 200 && who.data?.id === created.data.id, `session identity differs for ${name}`);
  users[name] = { id: uuid(created.data.id), token: loggedIn.data.access_token };
}
psqlFile(`${root}/seed.sql`, Object.fromEntries(names.map(name => [`${name}_id`, users[name].id])));

const rpc = (name, who = null, body = {}) => request(`/rest/v1/rpc/${name}`, {
  token: who?.token ?? null, method: 'POST', body,
});
const publish = (who, display = 'Técnico sintético isolado') => rpc('eut_publish_my_technician', who, {
  _display_name: display, _state_uf: 'PR', _city: 'Curitiba',
  _specialties: ['informatica'], _service_slugs: ['formatacao'],
  _neighborhood: 'Centro', _region: 'Região central', _bio: 'Atendimento profissional.',
});
const mine = (who) => request('/rest/v1/technicians?select=id,user_id,display_name,city,status,bio,specialties,service_slugs,avatar_path', {
  token: who.token,
});
const psqlSingle = (statement) => sql(statement);
const functionNames = [
  'public.eut_admin_enable_my_technician_role()',
  'public.eut_my_private_contact()',
  'public.eut_publish_my_technician(text,text,text,text[],text[],text,text,text)',
  'public.eut_remove_my_private_contact()',
  'public.eut_save_my_private_contact(text,boolean)',
  'public.eut_set_my_presence(boolean)',
  'public.eut_set_my_technician_avatar(text)',
  'public.eut_set_my_technician_coverage(integer,integer[])',
];
const functionList = functionNames.map((signature) => `('${signature}')`).join(',');
const functionSnapshot = () => sql(`WITH expected(signature) AS (VALUES ${functionList})
  SELECT string_agg(expected.signature || '=' || md5(pg_get_functiondef(to_regprocedure(expected.signature))) ||
    ':' || coalesce(p.proacl::text,'NULL') || ':' || p.prosecdef::text, '|' ORDER BY expected.signature)
  FROM expected JOIN pg_proc p ON p.oid=to_regprocedure(expected.signature)`);
const policySnapshot = () => sql(`SELECT string_agg(c.oid::regclass::text || ':' ||
  c.relrowsecurity::text || ':' || coalesce(p.polname,'-') || ':' ||
  coalesce(pg_get_expr(p.polqual,p.polrelid),'NULL') || ':' ||
  coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'NULL'), '|' ORDER BY c.oid::regclass::text,p.polname)
  FROM pg_class c LEFT JOIN pg_policy p ON p.polrelid=c.oid
  WHERE c.oid IN ('public.technicians'::regclass,'public.user_roles'::regclass,
    'public.eut_technician_private_contacts'::regclass,'public.eut_admin_management_log'::regclass)`);
const rowSnapshot = () => sql(`SELECT (SELECT count(*) FROM public.technicians)::text || ':' ||
  (SELECT count(*) FROM public.eut_technician_private_contacts)::text || ':' ||
  (SELECT count(*) FROM public.eut_qa_historical_request)::text || ':' ||
  (SELECT count(*) FROM public.eut_admin_management_log)::text`);

// Testemunha anterior: auth.uid() e papel tecnico NAO bastam para a RPC antiga.
const oldDenied = await publish(users.owner);
ensure(oldDenied.status >= 400, 'a RPC anterior nao exigiu a prova adicional');
ensure(sql('SELECT count(*) FROM public.technicians') === '2', 'a RPC anterior gravou ficha inesperada');
// Reproduz apenas em localhost o bypass original da politica de UPDATE.
const originalSuspended = sql("SELECT status FROM public.technicians WHERE user_id='" + users.suspended.id + "'");
ensure(originalSuspended === 'suspenso', 'fixture nao iniciou suspensa');
const baselineStatusPatch = await request('/rest/v1/technicians?user_id=eq.' + users.suspended.id, {
  token: users.suspended.token, method: 'PATCH',
  body: { status: 'pendente', coverage_city_ids: [] },
});
ensure(baselineStatusPatch.status < 400 &&
  sql("SELECT status FROM public.technicians WHERE user_id='" + users.suspended.id + "'") === 'pendente',
  'baseline nao demonstrou a transicao RLS indevida');
sql("UPDATE public.technicians SET status='suspenso' WHERE user_id='" + users.suspended.id + "'");
console.log('PASS 1A: bypass anterior reproduzido apenas em fixture sintetica local.');
const originalFunctions = functionSnapshot();
const originalPolicies = policySnapshot();
console.log('PASS 1: contrato antigo rejeita sessao sem atestacao adicional.');

// Testa o SQL proposto SEM MODIFICACAO, em Postgres local com funcoes reais.
psqlFile('docs/sql/eut-technician-self-service-no-confirmation-proposal-20261120.sql');
sql("NOTIFY pgrst, 'reload schema'");
await new Promise(resolve => setTimeout(resolve, 1300));
ensure(policySnapshot() !== originalPolicies, 'a politica RLS de titular nao foi endurecida');
const statusOf = (u) => sql("SELECT status FROM public.technicians WHERE user_id='" + u.id + "'");
for (const [label, account, original] of [
  ['suspenso', users.suspended, 'suspenso'],
  ['rejeitado', users.rejected, 'rejeitado'],
]) {
  const before = sql("SELECT md5(row_to_json(t)::text) FROM public.technicians t WHERE user_id='" + account.id + "'");
  const attempted = await request('/rest/v1/technicians?user_id=eq.' + account.id, {
    token: account.token, method: 'PATCH',
    body: { status: 'pendente', coverage_city_ids: [] },
  });
  ensure(attempted.status < 500 && statusOf(account) === original &&
    sql("SELECT md5(row_to_json(t)::text) FROM public.technicians t WHERE user_id='" + account.id + "'") === before,
    label + ' alterou a propria ficha restrita por UPDATE direto');
}
const adminChange = async (status) => request('/rest/v1/technicians?user_id=eq.' + users.suspended.id, {
  token: users.admin.token, method: 'PATCH', body: { status, coverage_city_ids: [] },
});
ensure((await adminChange('pendente')).status < 400 && statusOf(users.suspended) === 'pendente',
  'moderacao administrativa legitima foi indevidamente bloqueada');
ensure((await adminChange('suspenso')).status < 400 && statusOf(users.suspended) === 'suspenso',
  'administrador nao conseguiu restaurar a suspensao');
console.log('PASS 1B: suspenso/rejeitado negados; moderacao administrativa preservada.');
const anonDenied = await publish(null);
ensure(anonDenied.status >= 400, 'anon criou ficha por RPC');
const clientDenied = await publish(users.client);
ensure(clientDenied.status >= 400, 'cliente criou ficha tecnica sem papel');

const ownCreated = await publish(users.owner);
ensure(ownCreated.status === 200 && ownCreated.data?.state === 'publicado', 'criar ficha propria falhou');
const ownId = uuid(ownCreated.data.technician_id);
const otherCreated = await publish(users.other, 'Técnico independente');
ensure(otherCreated.status === 200 && otherCreated.data?.state === 'publicado', 'outra conta nao pode criar a propria ficha');
let read = await mine(users.owner);
ensure(read.status === 200 && read.data?.length === 1 && read.data[0].id === ownId && read.data[0].status === 'aprovado',
  'nao releu a propria criacao');
const isolation = await mine(users.other);
ensure(isolation.status === 200 && isolation.data?.length === 1 && isolation.data[0].user_id === users.other.id,
  'RLS expôs ficha de outra conta');
const beforeForeign = sql("SELECT display_name FROM public.technicians WHERE user_id='" + users.owner.id + "'");
const patchOther = await request('/rest/v1/technicians?user_id=eq.' + users.owner.id, {
  token: users.other.token, method: 'PATCH', body: { display_name: 'Invasão' },
});
ensure(patchOther.status < 500 &&
  sql("SELECT display_name FROM public.technicians WHERE user_id='" + users.owner.id + "'") === beforeForeign,
  'UPDATE indevido em terceiro modificou os dados');
console.log('PASS 2: criar, ler e RLS: anon, cliente e alteracao de terceiros recusados.');

const edited = await publish(users.owner, 'Técnico sintético atualizado');
ensure(edited.status === 200 && edited.data?.technician_id === ownId, 'editar gerou duplicata');
read = await mine(users.owner);
ensure(read.data?.[0]?.display_name === 'Técnico sintético atualizado', 'edicao nao persistiu na releitura');
ensure(sql(`SELECT count(*) FROM public.technicians WHERE user_id='${users.owner.id}'`) === '1',
  'duplicou a ficha tecnica');
const phone = await rpc('eut_save_my_private_contact', users.owner, {
  _phone: '41988887777', _allow_paid_contact: true,
});
ensure(phone.status === 200 && phone.data?.saved === true, 'salvar contato privado falhou');
const privateRead = await rpc('eut_my_private_contact', users.owner);
ensure(privateRead.status === 200 && privateRead.data?.phone === '+5541988887777', 'releitura do proprio telefone falhou');
const otherContact = await rpc('eut_my_private_contact', users.other);
ensure(otherContact.status === 200 && !otherContact.data?.has_number, 'contato privado de terceiro vazou');
console.log('PASS 3: editar/salvar/reler, contato privado e ausencia de duplicatas.');

// Todas as demais RPCs de autosservico removeram apenas a exigencia extra.
ensure((await rpc('eut_set_my_presence', users.owner, { _available: true })).status === 200,
  'presenca recusou sem prova adicional');
ensure((await rpc('eut_set_my_technician_avatar', users.owner, { _path: null })).status === 200,
  'avatar recusou sem prova adicional');
ensure((await rpc('eut_set_my_technician_coverage', users.owner, {
  _radius_km: 20, _city_ids: [4106902],
})).status === 200, 'cobertura recusou sem prova adicional');
const enableAdmin = await rpc('eut_admin_enable_my_technician_role', users.admin);
ensure(enableAdmin.status === 200 && enableAdmin.data?.admin_preserved === true &&
  enableAdmin.data?.technician_enabled === true, 'papel admin+tecnico nao foi preservado');
ensure(sql(`SELECT count(*) FROM public.user_roles WHERE user_id='${users.admin.id}' AND role='admin'`) === '1',
  'ativacao propria removeu admin');
console.log('PASS 4: cobertura, avatar, presenca, auto-habilitacao admin sem confirmacao adicional.');

// Historico de negocio sintetico vinculado por FK RESTRICT deve sobreviver.
sql(`INSERT INTO public.eut_qa_historical_request(technician_id,description) VALUES ('${ownId}','Histórico sintético protegido')`);
const wrongRemove = await rpc('eut_remove_my_technician_profile', users.other, { profile_id: ownId });
ensure(wrongRemove.status >= 400, 'RPC aceitou ID de terceiro no corpo');
const removed = await rpc('eut_remove_my_technician_profile', users.owner);
ensure(removed.status === 200 && removed.data?.state === 'removido' && removed.data?.technician_id === ownId,
  'exclusao da propria ficha falhou');
read = await mine(users.owner);
ensure(read.status === 200 && read.data?.length === 1 && read.data[0].status === 'pendente' &&
  read.data[0].display_name === 'Ficha excluída' && read.data[0].bio === null &&
  read.data[0].specialties.length === 0 && read.data[0].service_slugs.length === 0 &&
  read.data[0].avatar_path === null, 'exclusao nao persistiu no proprio perfil');
ensure(sql(`SELECT count(*) FROM public.eut_qa_historical_request WHERE technician_id='${ownId}'`) === '1',
  'exclusao apagou historico obrigatorio');
ensure(sql(`SELECT count(*) FROM public.eut_technician_private_contacts WHERE user_id='${users.owner.id}'`) === '0',
  'exclusao manteve contato privado');
ensure(sql(`SELECT count(*) FROM public.eut_admin_management_log WHERE target_key='${ownId}' AND action='technician_self_remove'`) === '1',
  'exclusao sem auditoria propria');
const repeat = await rpc('eut_remove_my_technician_profile', users.owner);
ensure(repeat.status === 200 && repeat.data?.state === 'removido' &&
  sql(`SELECT count(*) FROM public.eut_admin_management_log WHERE target_key='${ownId}' AND action='technician_self_remove'`) === '1',
  'exclusao nao idempotente');
console.log('PASS 5: exclusao, releitura, telefone removido, historico intacto e idempotencia.');

const suspendedBefore = psqlSingle(`SELECT md5(row_to_json(t)::text) FROM public.technicians t WHERE user_id='${users.suspended.id}'`);
const suspendedEdit = await publish(users.suspended);
const suspendedDelete = await rpc('eut_remove_my_technician_profile', users.suspended);
ensure(suspendedEdit.status === 200 && suspendedEdit.data?.state === 'bloqueado_por_seguranca',
  'suspenso editou status ou dados');
ensure(suspendedDelete.status >= 400 &&
  psqlSingle(`SELECT md5(row_to_json(t)::text) FROM public.technicians t WHERE user_id='${users.suspended.id}'`) === suspendedBefore,
  'suspenso foi alterado');
const suspendedPhone = await rpc('eut_save_my_private_contact', users.suspended, {
  _phone: '41988887777', _allow_paid_contact: true,
});
ensure(suspendedPhone.status >= 400 &&
  sql(`SELECT count(*) FROM public.eut_technician_private_contacts WHERE user_id='${users.suspended.id}'`) === '0',
  'suspenso gravou ou ativou contato comercial');
ensure((await rpc('eut_my_private_contact', users.suspended)).status === 200 &&
  (await rpc('eut_remove_my_private_contact', users.suspended)).status === 200,
  'suspenso perdeu acesso de privacidade ao proprio contato');
ensure((await publish(users.blocked)).status >= 400, 'conta bloqueada publicou');
ensure((await rpc('eut_remove_my_technician_profile', users.blocked)).status >= 400,
  'conta bloqueada excluiu');
ensure(sql(`SELECT count(*) FROM public.technicians WHERE user_id IN ('${users.blocked.id}','${users.client.id}')`) === '0',
  'negativas gravaram perfis');
console.log('PASS 6: suspensos nao gravam contato; leitura/remocao propria, bloqueados e cliente preservados.');

const recreated = await publish(users.owner, 'Técnico republicado sintético');
ensure(recreated.status === 200 && recreated.data?.technician_id === ownId &&
  (await mine(users.owner)).data?.[0]?.status === 'aprovado',
  'republicacao do proprio perfil nao foi persistida');
ensure(sql(`SELECT count(*) FROM public.technicians WHERE user_id='${users.owner.id}'`) === '1',
  'republicacao duplicou ficha');
console.log('PASS 7: republicacao e releitura da mesma ficha, sem outro cadastro.');

// Rollback integral em UMA transacao local, a partir do snapshot das 8 RPCs.
// A verificacao de hashes ocorre antes de qualquer CREATE/DROP; drift aborta.
const patchedFunctions = functionSnapshot();
ensure(patchedFunctions !== originalFunctions &&
  sql("SELECT to_regprocedure('public.eut_remove_my_technician_profile()') IS NOT NULL") === 't',
  'patch nao alterou as RPCs esperadas');
const rollbackPairs = functionNames.map((signature) => {
  const hash = sql(`SELECT md5(pg_get_functiondef(to_regprocedure('${signature}')))`);
  ensure(/^[0-9a-f]{32}$/.test(hash), `hash ausente: ${signature}`);
  return `('${signature}','${hash}')`;
}).join(',');
const savedDefinitions = readFileSync(`${root}/baseline.sql`, 'utf8')
  .replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
const patchedOwnerPolicyHash = sql("SELECT md5(coalesce(qual,'') || '|' || coalesce(with_check,'')) FROM pg_policies WHERE schemaname='public' AND tablename='technicians' AND policyname='Owner edits back to pending'");
ensure(/^[0-9a-f]{32}$/.test(patchedOwnerPolicyHash), 'hash de politica nao existe');
const rollback = `BEGIN;
DO $rollback$
DECLARE row_expected record;
BEGIN
  IF (SELECT md5(coalesce(qual,'') || '|' || coalesce(with_check,'')) FROM pg_policies
      WHERE schemaname='public' AND tablename='technicians'
        AND policyname='Owner edits back to pending') IS DISTINCT FROM '${patchedOwnerPolicyHash}' THEN
    RAISE EXCEPTION 'Rollback: policy drift detectado';
  END IF;
  IF to_regprocedure('public.eut_remove_my_technician_profile()') IS NULL THEN
    RAISE EXCEPTION 'Rollback: funcao de exclusao ausente';
  END IF;
  FOR row_expected IN SELECT * FROM (VALUES ${rollbackPairs}) AS v(signature,hash) LOOP
    IF md5(pg_get_functiondef(to_regprocedure(row_expected.signature))) IS DISTINCT FROM row_expected.hash THEN
      RAISE EXCEPTION 'Rollback: drift detectado em %', row_expected.signature;
    END IF;
  END LOOP;
END $rollback$;
${savedDefinitions}
ALTER POLICY "Owner edits back to pending" ON public.technicians
  USING (auth.uid() = user_id);
REVOKE ALL ON FUNCTION public.eut_remove_my_technician_profile() FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.eut_remove_my_technician_profile();
COMMIT;`;
const runRollback = (script) => execFileSync('psql', ['-X','-v','ON_ERROR_STOP=1'], {
  env: { ...process.env, PGHOST: '127.0.0.1', PGPORT: '54322',
    PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: 'postgres' },
  input: script, encoding: 'utf8', stdio: ['pipe','pipe','pipe'],
});
const beforeRollbackRows = rowSnapshot();
let driftRejected = false;
try {
  runRollback(rollback.replace(rollbackPairs.match(/[0-9a-f]{32}/)[0], '00000000000000000000000000000000'));
} catch (error) {
  driftRejected = /drift detectado/.test(String(error.stderr));
}
ensure(driftRejected && functionSnapshot() === patchedFunctions &&
  sql("SELECT to_regprocedure('public.eut_remove_my_technician_profile()') IS NOT NULL") === 't',
  'rollback com drift alterou esquema parcialmente');
console.log('PASS 8: rollback com hash divergente abortou sem modificacao parcial.');
let policyDriftRejected = false;
try {
  runRollback(rollback.replace(patchedOwnerPolicyHash, '00000000000000000000000000000000'));
} catch (error) {
  policyDriftRejected = /policy drift detectado/.test(String(error.stderr));
}
ensure(policyDriftRejected && functionSnapshot() === patchedFunctions &&
  policySnapshot() !== originalPolicies, 'rollback ignorou drift da politica');
console.log('PASS 8A: rollback com drift de RLS abortou sem mutacao.');

runRollback(rollback);
sql("NOTIFY pgrst, 'reload schema'");
await new Promise(resolve => setTimeout(resolve, 1300));
ensure(functionSnapshot() === originalFunctions && policySnapshot() === originalPolicies,
  'rollback nao restaurou hashes, grants ou RLS originais');
ensure(rowSnapshot() === beforeRollbackRows &&
  sql("SELECT to_regprocedure('public.eut_remove_my_technician_profile()') IS NULL") === 't',
  'rollback removeu dados, deixou funcao nova ou alterou historicos');
ensure((await publish(users.owner)).status >= 400, 'RPC antiga nao foi restaurada');
console.log('PASS 9: rollback atomico restaura oito RPCs/grants/RLS, remove exclusao e preserva historicos.');
console.log('RESULTADO: 12 grupos PASS; GoTrue real, PostgREST e PostgreSQL locais; sem SQL/usuarios externos.');
