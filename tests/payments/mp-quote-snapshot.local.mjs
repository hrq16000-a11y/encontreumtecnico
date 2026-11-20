// Deterministic local-only contract test. Never connects to Supabase or PSP.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

const packageRoot = process.env.MP_PG_PACKAGE_ROOT;
if (!packageRoot) throw new Error('Set MP_PG_PACKAGE_ROOT to disposable local PostgreSQL packages');
const require = createRequire(join(resolve(packageRoot),'package.json'));
const EmbeddedPostgres = require('embedded-postgres').default;
const { Client } = require('pg');
const sql = async path => readFile(new URL(path,import.meta.url),'utf8');
const fixture = await sql('./mp-owner-fixture.sql');
const ownerSql = await sql('../../docs/sql/eut-mp-owner-settings-20261120.sql');
const snapshotSql = await sql('../../docs/sql/eut-mp-quote-snapshot-20261120.sql');
const owner = '10000000-0000-4000-8000-000000000001';
const session = '20000000-0000-4000-8000-000000000001';
const clients = [];
let count=0;

async function check(label,fn) { await fn(); console.log(`PASS ${label}`); count++; }
async function rejectsCode(promise,code) {
  await assert.rejects(promise, err=>{
    assert.equal(err.code,code,`${err.message} (expected SQLSTATE ${code})`);
    return true;
  });
}
const socket=createServer();
await new Promise((ok,bad)=>socket.once('error',bad).listen(0,'127.0.0.1',ok));
const port=socket.address().port;
await new Promise(ok=>socket.close(ok));
const databaseDir=await mkdtemp(join(resolve(packageRoot),'mp-quote-'));
const pg=new EmbeddedPostgres({databaseDir,user:'postgres',password:'synthetic-local-only',
  port,persistent:false,autoRehydrateSymlinks:true,
  postgresFlags:['-c','listen_addresses=127.0.0.1','-c','unix_socket_directories='],
  onLog:message=>{if(process.env.MP_PG_DEBUG)console.error(message);},
});
let started=false;

async function connect(role) {
  const db=new Client({host:'127.0.0.1',port,user:'postgres',
    password:'synthetic-local-only',database:'postgres',connectionTimeoutMillis:4000});
  await db.connect();clients.push(db);
  if(role){
    await db.query(`SET ROLE ${role}`);
    await db.query('SELECT set_config($1,$2,false)',[
      'request.jwt.claims',JSON.stringify({sub:owner,session_id:session}),
    ]);
  }
  return db;
}

const selectSql='SELECT eut_migration.mp_quote_snapshot_at($1::timestamptz) AS quote';
const updateSql=`SELECT public.eut_admin_mp_update_settings(
  $1::boolean,$2::integer,$3::integer,$4::text,$5::text,
  $6::smallint,$7::bigint,$8::text) AS result`;
async function quote(root,instant){return (await root.query(selectSql,[instant])).rows[0].quote;}
const updateArgs=(enabled,regular,outside,version)=>
  [enabled,regular,outside,'10:00','16:00',1,version,'Homologação sintética de preços'];

try {
  await pg.initialise();
  await pg.start();started=true;
  const root=await connect();
  const version=(await root.query('SHOW server_version')).rows[0].server_version;
  assert.match(version,/^17\./);
  await root.query(fixture);

  await check('preflight recusa contrato ausente e não instala nada',async()=>{
    await rejectsCode(root.query(snapshotSql),'P0001');
    await root.query('ROLLBACK');
    assert.equal((await root.query(`SELECT to_regprocedure(
      'eut_migration.mp_quote_snapshot_at(timestamp with time zone)') AS value`)).rows[0].value,null);
  });
  await root.query(ownerSql);
  await root.query(snapshotSql);
  const actor=await connect('authenticated');
  const anonymous=await connect('anon');

  await check('schema privado: anônimo e autenticado não executam nem leem a tabela',async()=>{
    for(const role of ['anon','authenticated']){
      const grant=(await root.query(`SELECT has_function_privilege($1,
        'eut_migration.mp_quote_snapshot_at(timestamp with time zone)','EXECUTE') AS allowed`,[role])).rows[0].allowed;
      assert.equal(grant,false);
    }
    await rejectsCode(actor.query(selectSql,['2026-11-20T12:00:00Z']),'42501');
    await rejectsCode(anonymous.query(selectSql,['2026-11-20T12:00:00Z']),'42501');
    await rejectsCode(actor.query('SELECT * FROM eut_migration.mp_owner_settings'),'42501');
  });

  await check('preços iniciais e quatro bordas horárias São Paulo',async()=>{
    for(const [instant,amount] of [
      ['2026-11-20T11:59:00Z',2999],['2026-11-20T12:00:00Z',999],
      ['2026-11-20T20:59:00Z',999],['2026-11-20T21:00:00Z',2999],
    ]){
      const q=await quote(root,instant);
      assert.equal(q.quoted_price_cents,amount);
      assert.equal(q.price_version,1);
      assert.equal(q.commercial_enabled,false);
      assert.equal(q.currency,'BRL');
      assert.equal(q.daily_contact_limit,2);
      assert.equal(q.payment_available,false);
      assert.equal(q.contact_released,false);
    }
    await rejectsCode(root.query(selectSql,[null]),'22023');
  });

  await check('edição auditada altera preço, horário, limite e versão da próxima cotação',async()=>{
    const changed=(await actor.query(updateSql,updateArgs(true,1599,4099,1))).rows[0].result;
    assert.equal(changed.version,2);
    for(const [instant,amount] of [
      ['2026-11-20T12:59:00Z',4099],['2026-11-20T13:00:00Z',1599],
      ['2026-11-20T18:59:00Z',1599],['2026-11-20T19:00:00Z',4099],
    ]){
      const q=await quote(root,instant);
      assert.equal(q.quoted_price_cents,amount);
      assert.equal(q.price_version,2);
      assert.equal(q.daily_contact_limit,1);
      assert.equal(q.commercial_enabled,true);
      assert.equal(q.payment_available,false);
      assert.equal(q.contact_released,false);
    }
    assert.equal((await root.query('SELECT count(*)::int AS n FROM eut_migration.mp_owner_settings_audit')).rows[0].n,1);
  });

  await check('desativação comercial não habilita cobrança nem expõe contato',async()=>{
    assert.equal((await actor.query(updateSql,updateArgs(false,1599,4099,2))).rows[0].result.version,3);
    const q=await quote(root,'2026-11-20T13:00:00Z');
    assert.equal(q.commercial_enabled,false);
    assert.equal(q.payment_available,false);
    assert.equal(q.contact_released,false);
    assert.equal(q.price_version,3);
    assert.equal((await root.query('SELECT count(*)::int AS n FROM eut_migration.mp_owner_settings_audit')).rows[0].n,2);
  });

  await check('cotação usa snapshot transacional: mudança não confirmada não vaza',async()=>{
    const concurrent=await connect('authenticated');
    await concurrent.query('BEGIN');
    try{
      const result=(await concurrent.query(updateSql,updateArgs(true,1999,4999,3))).rows[0].result;
      assert.equal(result.version,4);
      const before=await quote(root,'2026-11-20T13:00:00Z');
      assert.deepEqual([before.price_version,before.quoted_price_cents,before.commercial_enabled],[3,1599,false]);
      await concurrent.query('COMMIT');
    }finally{await concurrent.query('ROLLBACK').catch(()=>{});}
    const after=await quote(root,'2026-11-20T13:00:00Z');
    assert.deepEqual([after.price_version,after.quoted_price_cents,after.commercial_enabled],[4,1999,true]);
    assert.equal((await root.query('SELECT count(*)::int AS n FROM eut_migration.mp_owner_settings_audit')).rows[0].n,3);
  });

  await check('resolvedor somente leitura: nenhum pedido, direito ou pagamento criado',async()=>{
    const functions=(await root.query(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='eut_migration' AND proname='mp_quote_snapshot_at'`)).rows;
    assert.equal(functions.length,1);
    assert.doesNotMatch(snapshotSql,/\b(insert|update|delete)\s+(into\s+|from\s+)?public\.eut_contact_/i);
    assert.doesNotMatch(snapshotSql,/\b(payment_available|contact_released)'\s*,\s*true\b/i);
    assert.equal((await root.query(`SELECT to_regclass('public.eut_contact_entitlements') AS t`)).rows[0].t,null);
    assert.equal((await root.query(`SELECT to_regclass('public.eut_contact_purchase_intents') AS t`)).rows[0].t,null);
  });

  console.log(JSON.stringify({result:'PASS',postgres:version,tests:count,
    finalVersion:4,auditEvents:3,isolated:true,synthetic:true,productionChanges:false,charges:false}));
}catch(error){
  console.error(`FAIL ${error?.message??String(error)}`);
  console.error(error?.stack??error);
  process.exitCode=1;
}finally{
  await Promise.allSettled(clients.map(db=>db.end()));
  if(started)await pg.stop().catch(err=>console.error(`stop error: ${err.message}`));
  await rm(databaseDir,{recursive:true,force:true});
}
