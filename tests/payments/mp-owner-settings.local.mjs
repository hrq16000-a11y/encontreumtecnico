// Local-only PostgreSQL 17 test harness for the draft Mercado Pago owner contract.
// Never connects to a Supabase endpoint. No real users, checkout or charges.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

const packageRoot = process.env.MP_PG_PACKAGE_ROOT;
if (!packageRoot) throw new Error('MP_PG_PACKAGE_ROOT required (isolated local runtime)');
const require = createRequire(join(resolve(packageRoot), 'package.json'));
const EmbeddedPostgres = require('embedded-postgres').default;
const { Client } = require('pg');
const fixture = await readFile(new URL('./mp-owner-fixture.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../docs/sql/eut-mp-owner-settings-20261120.sql', import.meta.url), 'utf8');
const owner = '10000000-0000-4000-8000-000000000001';
const admin = '10000000-0000-4000-8000-000000000002';
const client = '10000000-0000-4000-8000-000000000003';
const ownerSession = '20000000-0000-4000-8000-000000000001';
const adminSession = '20000000-0000-4000-8000-000000000002';
const clientSession = '20000000-0000-4000-8000-000000000003';
const cases = [];
const connections = [];

function check(name, fn) {
  return (async () => {
    await fn();
    cases.push({ name, status: 'PASS' });
    process.stdout.write(`PASS ${name}\n`);
  })();
}

async function failsWith(promise, code) {
  await assert.rejects(promise, err => {
    assert.equal(err.code, code, `${err.message} (got ${err.code}, expected ${code})`);
    return true;
  });
}

const readSql = 'SELECT public.eut_admin_mp_settings() AS settings';
const updateSql = `SELECT public.eut_admin_mp_update_settings(
  $1::boolean,$2::integer,$3::integer,$4::text,$5::text,
  $6::smallint,$7::bigint,$8::text) AS result`;
function settingsArgs({ enabled = true, regular = 1199, outside = 2999,
  from = '09:00', until = '18:00', limit = 2, version = 1,
  reason = 'Ajuste de preço em homologação' } = {}) {
  return [enabled, regular, outside, from, until, limit, version, reason];
}

const socket = createServer();
await new Promise((ok, bad) => socket.once('error', bad).listen(0, '127.0.0.1', ok));
const port = socket.address().port;
await new Promise(ok => socket.close(ok));
const databaseDir = await mkdtemp(join(resolve(packageRoot), 'mp-contract-'));
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres', password: 'synthetic-local-only', port,
  persistent: false, autoRehydrateSymlinks: true,
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'unix_socket_directories='],
  onLog: message => { if (process.env.MP_PG_DEBUG) console.error('postgres:',message); },
});
let started = false;

async function connect(asRole, actor = null, session = null) {
  const db = new Client({ host: '127.0.0.1', port, user: 'postgres',
    password: 'synthetic-local-only', database: 'postgres', connectionTimeoutMillis: 4000 });
  await db.connect();
  connections.push(db);
  if (asRole) {
    await db.query(`SET ROLE ${asRole}`);
    await db.query('SELECT set_config($1,$2,false)', [
      'request.jwt.claims', JSON.stringify(actor ? { sub: actor, session_id: session } : {}),
    ]);
  }
  return db;
}

try {
  await pg.initialise();
  await pg.start();
  started = true;
  const root = await connect();
  const server = (await root.query('SHOW server_version')).rows[0].server_version;
  assert.match(server, /^17\./, 'must exercise PostgreSQL 17');
  await root.query(fixture);
  await root.query(migration);
  const own = await connect('authenticated', owner, ownerSession);
  const otherAdmin = await connect('authenticated', admin, adminSession);
  const customer = await connect('authenticated', client, clientSession);
  const anonymous = await connect('anon');

  await check('RLS ativo e acesso direto às tabelas negado', async () => {
    const rows = (await root.query(`SELECT c.relname,c.relrowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='eut_migration' AND c.relkind='r'
      AND c.relname LIKE 'mp_owner_settings%'`)).rows;
    assert.equal(rows.length, 2);
    assert.ok(rows.every(r => r.relrowsecurity));
    for (const role of ['anon', 'authenticated']) {
      for (const table of ['mp_owner_settings', 'mp_owner_settings_audit']) {
        const access = await root.query('SELECT has_table_privilege($1,$2,$3) AS granted',
          [role, `eut_migration.${table}`, 'SELECT, INSERT, UPDATE, DELETE']);
        assert.equal(access.rows[0].granted, false);
      }
    }
    await failsWith(own.query('SELECT * FROM eut_migration.mp_owner_settings'), '42501');
    await failsWith(own.query('UPDATE eut_migration.mp_owner_settings SET enabled=true'), '42501');
    await failsWith(own.query('SELECT * FROM eut_migration.mp_owner_settings_audit'), '42501');
  });

  await check('proprietário lê valores iniciais, pagamento desativado', async () => {
    const s = (await own.query(readSql)).rows[0].settings;
    assert.deepEqual([s.enabled,s.regular_price_cents,s.outside_price_cents,
      s.regular_from,s.regular_until,s.daily_contact_limit,s.version],
      [false,999,2999,'09:00','18:00',2,1]);
  });

  await check('anon, cliente e segundo administrador não acessam RPCs', async () => {
    for (const actor of [otherAdmin,customer]) {
      await failsWith(actor.query(readSql), '42501');
      await failsWith(actor.query(updateSql, settingsArgs()), '42501');
    }
    await failsWith(anonymous.query(readSql), '42501');
    await failsWith(anonymous.query(updateSql, settingsArgs()), '42501');
    await failsWith(own.query('SELECT eut_migration.mp_is_current_owner()'), '42501');
  });

  await check('sessão trocada, expirada, conta inativa, email pendente e owner não reivindicado bloqueados', async () => {
    const spoof = await connect('authenticated', owner, adminSession);
    await failsWith(spoof.query(readSql), '42501');
    await root.query('UPDATE auth.sessions SET not_after=now()-interval \'1 minute\' WHERE id=$1',[ownerSession]);
    await failsWith(own.query(readSql), '42501');
    await root.query('UPDATE auth.sessions SET not_after=now()+interval \'1 day\' WHERE id=$1',[ownerSession]);
    await root.query('UPDATE public.fixture_operational SET active=false WHERE user_id=$1',[owner]);
    await failsWith(own.query(readSql), '42501');
    await root.query('UPDATE public.fixture_operational SET active=true WHERE user_id=$1',[owner]);
    await root.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1',[owner]);
    await failsWith(own.query(readSql), '42501');
    await root.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[owner]);
    await root.query('UPDATE eut_migration.project_owner_bootstrap SET claimed_user_id=NULL');
    await failsWith(own.query(readSql), '42501');
    await root.query('UPDATE eut_migration.project_owner_bootstrap SET claimed_user_id=$1',[owner]);
  });

  await check('atualização persistida com incremento de versão e trilha auditável', async () => {
    const result = (await own.query(updateSql, settingsArgs())).rows[0].result;
    assert.deepEqual(result,{ok:true,version:2});
    const s = (await own.query(readSql)).rows[0].settings;
    assert.equal(s.enabled,true);
    assert.equal(s.regular_price_cents,1199);
    assert.equal(s.version,2);
    const audits = (await root.query('SELECT * FROM eut_migration.mp_owner_settings_audit')).rows;
    assert.equal(audits.length,1);
    const a = audits[0];
    assert.equal(a.actor_id,owner);
    assert.equal(a.session_id,ownerSession);
    assert.equal(a.previous_settings.version,1);
    assert.equal(a.new_settings.version,2);
    assert.equal(a.previous_settings.regular_price_cents,999);
    assert.equal(a.new_settings.regular_price_cents,1199);
    assert.equal(a.reason,'Ajuste de preço em homologação');
    const independent = await connect('authenticated',owner,ownerSession);
    assert.equal((await independent.query(readSql)).rows[0].settings.version,2);
  });

  await check('rollback desfaz configuração e evento de auditoria juntos', async () => {
    const transaction = await connect('authenticated',owner,ownerSession);
    await transaction.query('BEGIN');
    try {
      const changed = (await transaction.query(updateSql,
        settingsArgs({version:2,regular:1299}))).rows[0].result;
      assert.equal(changed.version,3);
      assert.equal((await transaction.query(readSql)).rows[0].settings.regular_price_cents,1299);
    } finally {
      await transaction.query('ROLLBACK');
    }
    assert.equal((await own.query(readSql)).rows[0].settings.regular_price_cents,1199);
    assert.equal((await own.query(readSql)).rows[0].settings.version,2);
    assert.equal((await root.query('SELECT count(*)::int AS n FROM eut_migration.mp_owner_settings_audit')).rows[0].n,1);
  });

  await check('no-op, preço, horário, motivo inválidos e versão obsoleta não gravam', async () => {
    await failsWith(own.query(updateSql,settingsArgs({version:2})), '22023');
    await failsWith(own.query(updateSql,settingsArgs({version:2,regular:99})), '22023');
    await failsWith(own.query(updateSql,settingsArgs({version:2,from:'18:01',until:'18:00'})), '22023');
    await failsWith(own.query(updateSql,settingsArgs({version:2,reason:'curto'})), '22023');
    await failsWith(own.query(updateSql,settingsArgs({version:1,regular:1399})), 'P0001');
    const count = (await root.query('SELECT count(*)::int AS n FROM eut_migration.mp_owner_settings_audit')).rows[0].n;
    assert.equal(count,1);
    assert.equal((await own.query(readSql)).rows[0].settings.version,2);
  });

  await check('corrida real: 2 conexões, bloqueio de linha e rejeição de update perdido', async () => {
    const first = await connect('authenticated',owner,ownerSession);
    const second = await connect('authenticated',owner,ownerSession);
    await first.query('BEGIN');
    await second.query('BEGIN');
    try {
      const v3 = (await first.query(updateSql,settingsArgs({version:2,outside:3999}))).rows[0].result;
      assert.equal(v3.version,3);
      let secondResolved = false;
      const contested = second.query(updateSql,settingsArgs({version:2,regular:1499}))
        .then(() => { secondResolved=true; throw new Error('lost update wrongly succeeded'); },
          err => { secondResolved=true; assert.equal(err.code,'P0001'); });
      await new Promise(done => setTimeout(done,200));
      assert.equal(secondResolved,false,'second transaction must await row lock');
      await first.query('COMMIT');
      await contested;
      await second.query('ROLLBACK');
    } finally {
      if (first) await first.query('ROLLBACK').catch(()=>{});
      if (second) await second.query('ROLLBACK').catch(()=>{});
    }
    const saved = (await own.query(readSql)).rows[0].settings;
    assert.equal(saved.version,3);
    assert.equal(saved.regular_price_cents,1199);
    assert.equal(saved.outside_price_cents,3999);
    assert.equal((await root.query('SELECT count(*)::int AS n FROM eut_migration.mp_owner_settings_audit')).rows[0].n,2);
  });

  console.log(JSON.stringify({result:'PASS',postgres:server,tests:cases.length,finalVersion:3,auditEvents:2,
    database:'disposable-local',identities:'synthetic',productionChanges:false,charges:false}));
} catch (err) {
  console.error(`FAIL ${err?.message ?? String(err)}`);
  console.error(err?.stack ?? err);
  process.exitCode=1;
} finally {
  await Promise.allSettled(connections.map(db=>db.end()));
  if (started) await pg.stop().catch(err=>console.error(`stop error: ${err.message}`));
  await rm(databaseDir,{recursive:true,force:true});
}
