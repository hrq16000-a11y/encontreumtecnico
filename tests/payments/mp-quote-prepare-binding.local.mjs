// Homologação isolada do SQL proposto a partir das RPCs oficiais lidas sem dados pessoais.
// Sem rede externa, Supabase oficial, conta PSP ou cobrança.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

const packageRoot=process.env.MP_PG_PACKAGE_ROOT;
if(!packageRoot)throw new Error('MP_PG_PACKAGE_ROOT must contain local PostgreSQL binaries');
const require=createRequire(join(resolve(packageRoot),'package.json'));
const EmbeddedPostgres=require('embedded-postgres').default;
const { Client }=require('pg');
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const [ownerFixture,bindingFixture,ownerSql,snapshotSql,legacyPrep,legacyQuote,bindingSql]=
  await Promise.all([
    read('./mp-owner-fixture.sql'),read('./mp-quote-binding-fixture.sql'),
    read('../../docs/sql/eut-mp-owner-settings-20261120.sql'),
    read('../../docs/sql/eut-mp-quote-snapshot-20261120.sql'),
    read('../../docs/sql/eut-contact-purchase-preparation.sql'),
    read('./mp-legacy-quote-baseline.sql'),
    read('../../docs/sql/eut-mp-quote-prepare-binding-20261120.sql'),
  ]);
const owner='10000000-0000-4000-8000-000000000001';
const clientA='10000000-0000-4000-8000-000000000003';
const clientB='10000000-0000-4000-8000-000000000006';
const techA='30000000-0000-4000-8000-000000000001';
const techB='30000000-0000-4000-8000-000000000002';
const ownerSession='20000000-0000-4000-8000-000000000001';
const clientASession='20000000-0000-4000-8000-000000000003';
const clientBSession='20000000-0000-4000-8000-000000000006';
const connections=[];
let passed=0;

async function check(label,fn){await fn();passed++;console.log(`PASS ${label}`);}
async function denied(promise,code){await assert.rejects(promise,error=>{
  assert.equal(error.code,code,`${error.message}: expected ${code}`);return true;
});}
function ensureNotReleased(result){
  assert.equal(result.payment_available,false);
  assert.notEqual(result.contact_released,true);
  assert.ok(!JSON.stringify(result).includes('synthetic-only'));
}
const quoteSql='SELECT public.eut_contact_access_quote($1::uuid) AS result';
const prepareSql='SELECT public.eut_prepare_contact_purchase($1::uuid) AS result';
const editSql=`SELECT public.eut_admin_mp_update_settings(
  $1::boolean,$2::integer,$3::integer,$4::text,$5::text,
  $6::smallint,$7::bigint,$8::text) AS result`;
const editArgs=(version,regular,outside,limit)=>[true,regular,outside,
  '00:00','23:59',limit,version,'Homologação sintética das cotações'];

const server=createServer();
await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
const port=server.address().port;
await new Promise(ok=>server.close(ok));
const databaseDir=await mkdtemp(join(resolve(packageRoot),'mp-bound-'));
const pg=new EmbeddedPostgres({databaseDir,user:'postgres',password:'synthetic-local-only',
  port,persistent:false,autoRehydrateSymlinks:true,
  postgresFlags:['-c','listen_addresses=127.0.0.1','-c','unix_socket_directories='],
  onLog:message=>{if(process.env.MP_PG_DEBUG)console.error(message);},
});
let started=false;
async function connect(role=null,actor=null,session=null){
  const db=new Client({host:'127.0.0.1',port,user:'postgres',
    password:'synthetic-local-only',database:'postgres',connectionTimeoutMillis:4000});
  await db.connect();connections.push(db);
  if(role){
    await db.query(`SET ROLE ${role}`);
    await db.query('SELECT set_config($1,$2,false)',[
      'request.jwt.claims',JSON.stringify(actor?{sub:actor,session_id:session}:{})
    ]);
  }
  return db;
}
const get=(db,sql,id)=>(db.query(sql,[id])).then(v=>v.rows[0].result);

try{
  await pg.initialise();await pg.start();started=true;
  const root=await connect();
  const version=(await root.query('SHOW server_version')).rows[0].server_version;
  assert.match(version,/^17\./);
  await root.query(ownerFixture);
  await root.query(bindingFixture);
  await root.query(legacyPrep);
  await root.query(legacyQuote);
  await root.query('REVOKE ALL ON FUNCTION public.eut_contact_access_quote(uuid) FROM PUBLIC,anon');
  await root.query('GRANT EXECUTE ON FUNCTION public.eut_contact_access_quote(uuid) TO authenticated');

  await check('baselines oficiais: hashes, ACL e RLS confirmados no PostgreSQL isolado',async()=>{
    const hashes=(await root.query(`SELECT p.proname,md5(pg_get_functiondef(p.oid)) AS hash
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN
        ('eut_contact_access_quote','eut_prepare_contact_purchase')`)).rows;
    assert.deepEqual(Object.fromEntries(hashes.map(h=>[h.proname,h.hash])),{
      eut_contact_access_quote:'bace159c188370479a3439cc9a056815',
      eut_prepare_contact_purchase:'be6b4a3105cd7bf7124ffe147c3d86ce',
    });
    assert.equal((await root.query(`SELECT relrowsecurity AS enabled FROM pg_class
      WHERE oid='public.eut_contact_purchase_intents'::regclass`)).rows[0].enabled,true);
  });

  await check('preflight recusa integração sem o contrato privado',async()=>{
    await denied(root.query(bindingSql),'P0001');
    await root.query('ROLLBACK');
    assert.equal((await root.query(`SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema='public' AND table_name='eut_contact_purchase_intents'
        AND column_name='pricing_version'`)).rows[0].n,0);
  });

  await root.query(ownerSql);
  await root.query(snapshotSql);
  await root.query(bindingSql);
  const own=await connect('authenticated',owner,ownerSession);
  const buyer=await connect('authenticated',clientA,clientASession);
  const other=await connect('authenticated',clientB,clientBSession);
  const anonymous=await connect('anon');

  await check('novos CHECK e coluna nullable preservam reservas legadas',async()=>{
    const c=(await root.query(`SELECT pg_get_constraintdef(oid,true) AS body
      FROM pg_constraint WHERE conname='eut_contact_purchase_intents_quoted_price_cents_check'`)).rows[0].body;
    assert.match(c,/quoted_price_cents >= 100 AND quoted_price_cents <= 99900/);
    const col=(await root.query(`SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='eut_contact_purchase_intents'
      AND column_name='pricing_version'`)).rows[0];
    assert.equal(col.is_nullable,'YES');
    await denied(root.query(`INSERT INTO public.eut_contact_purchase_intents
      (client_id,technician_id,access_date,quoted_price_cents,expires_at)
      VALUES ($1,$2,current_date,100000,now()+interval '10 minutes')`,[clientB,techB]),'23514');
  });

  await check('anônimo e admin não cotam; cliente não acessa dados diretamente',async()=>{
    await denied(get(anonymous,quoteSql,techA),'42501');
    await denied(get(anonymous,prepareSql,techA),'42501');
    await denied(get(own,quoteSql,techA),'P0001');
    await denied(get(own,prepareSql,techA),'P0001');
    await denied(buyer.query('SELECT * FROM public.eut_contact_purchase_intents'),'42501');
    await denied(buyer.query('SELECT * FROM public.eut_technician_private_contacts'),'42501');
    assert.equal((await root.query(`SELECT has_function_privilege('anon',
      'public.eut_contact_access_quote(uuid)','EXECUTE') AS access`)).rows[0].access,false);
    for(const name of ['eut_contact_access_quote','eut_prepare_contact_purchase']){
      assert.equal((await root.query(`SELECT has_function_privilege('authenticated',$1,'EXECUTE') AS granted`,
        [`public.${name}(uuid)`])).rows[0].granted,true);
      assert.equal((await root.query(`SELECT has_function_privilege('anon',$1,'EXECUTE') AS granted`,
        [`public.${name}(uuid)`])).rows[0].granted,false);
    }
    assert.equal((await root.query(`SELECT relrowsecurity FROM pg_class
      WHERE oid='public.eut_contact_purchase_intents'::regclass`)).rows[0].relrowsecurity,true);
  });

  await check('comercial desligado: cotação informativa, sem criar pré-pedidos',async()=>{
    const quote=await get(buyer,quoteSql,techA);
    assert.equal(quote.price_version,1);
    assert.equal(quote.commercial_enabled,false);
    assert.equal(quote.status,'pagamento_desativado');
    assert.equal(quote.daily_max_contacts,2);
    ensureNotReleased(quote);
    const result=await get(buyer,prepareSql,techA);
    assert.equal(result.state,'pagamento_desativado');
    ensureNotReleased(result);
    assert.equal((await root.query('SELECT count(*)::int AS n FROM public.eut_contact_purchase_intents')).rows[0].n,0);
  });

  await check('suspenso/sem consentimento não passa; nenhum telefone sai das RPCs',async()=>{
    await root.query(`UPDATE public.eut_technician_private_contacts SET allow_paid_contact=false
      WHERE user_id='10000000-0000-4000-8000-000000000005'`);
    const q=await get(buyer,quoteSql,techB);
    assert.equal(q.status,'contato_indisponivel');
    assert.equal(q.contact_ready,false);
    ensureNotReleased(q);
    const p=await get(buyer,prepareSql,techB);
    assert.equal(p.state,'contato_indisponivel');
    ensureNotReleased(p);
    await root.query(`UPDATE public.eut_technician_private_contacts SET allow_paid_contact=true
      WHERE user_id='10000000-0000-4000-8000-000000000005'`);
  });

  await check('admin altera preço/limite; cotação e pré-pedido persistem versão',async()=>{
    assert.equal((await own.query(editSql,editArgs(1,1599,4099,1))).rows[0].result.version,2);
    const q=await get(buyer,quoteSql,techA);
    const fromSnapshot=(await root.query(`SELECT eut_migration.mp_quote_snapshot_at(now()) AS snapshot`)).rows[0].snapshot;
    assert.equal(q.price_cents,fromSnapshot.quoted_price_cents);
    assert.equal(q.price_version,2);
    assert.equal(q.daily_max_contacts,1);
    assert.equal(q.commercial_hours,'00:00-23:59');
    assert.equal(q.status,'aguardando_integracao_pagamento');
    ensureNotReleased(q);
    const p=await get(buyer,prepareSql,techA);
    assert.equal(p.state,'preparado_sem_gateway');
    assert.equal(p.quoted_price_cents,q.price_cents);
    assert.equal(p.price_version,2);
    ensureNotReleased(p);
    assert.ok(p.order_id);
    const afterReserve=await get(buyer,quoteSql,techB);
    assert.equal(afterReserve.contacts_reserved_today,1);
    assert.equal(afterReserve.contacts_remaining_today,0);
    assert.equal(afterReserve.status,'limite_diario_atingido');
  });

  await check('edição nova não reprecifica pedido válido e limite 1 bloqueia outro',async()=>{
    const existing=await get(buyer,prepareSql,techA);
    assert.equal((await own.query(editSql,editArgs(2,1699,4499,1))).rows[0].result.version,3);
    const q=await get(buyer,quoteSql,techA);
    assert.equal(q.price_version,3);
    ensureNotReleased(q);
    const still=await get(buyer,prepareSql,techA);
    assert.equal(still.order_id,existing.order_id);
    assert.equal(still.quoted_price_cents,existing.quoted_price_cents);
    assert.equal(still.price_version,2);
    const limit=await get(buyer,prepareSql,techB);
    assert.equal(limit.state,'limite_diario_atingido');
    ensureNotReleased(limit);
    assert.equal((await root.query('SELECT count(*)::int AS n FROM public.eut_contact_purchase_intents')).rows[0].n,1);
  });

  await check('reserva legada de outro cliente preserva preço e versão NULL',async()=>{
    await root.query(`INSERT INTO public.eut_contact_purchase_intents
      (client_id,technician_id,access_date,quoted_price_cents,expires_at)
      VALUES ($1,$2,(now() AT TIME ZONE 'America/Sao_Paulo')::date,999,now()+interval '10 minutes')`,
      [clientB,techA]);
    const legacy=await get(other,prepareSql,techA);
    assert.equal(legacy.quoted_price_cents,999);
    assert.equal(legacy.price_version,null);
    ensureNotReleased(legacy);
  });

  await check('limite 2 + corrida simultânea geram uma única reserva por técnico',async()=>{
    assert.equal((await own.query(editSql,editArgs(3,1699,4499,2))).rows[0].result.version,4);
    const a=await connect('authenticated',clientA,clientASession);
    const b=await connect('authenticated',clientA,clientASession);
    const [p1,p2]=await Promise.all([get(a,prepareSql,techB),get(b,prepareSql,techB)]);
    assert.equal(p1.order_id,p2.order_id);
    assert.equal(p1.price_version,4);
    ensureNotReleased(p1);ensureNotReleased(p2);
    const rows=(await root.query('SELECT technician_id,pricing_version FROM public.eut_contact_purchase_intents WHERE client_id=$1',[clientA])).rows;
    assert.equal(rows.length,2);
    assert.equal(rows.filter(r=>r.technician_id===techB).length,1);
    const q=await get(buyer,quoteSql,techB);
    assert.equal(q.contacts_reserved_today,2);
    assert.equal(q.contacts_remaining_today,0);
    ensureNotReleased(q);
    assert.equal((await root.query('SELECT count(*)::int AS n FROM public.eut_contact_entitlements')).rows[0].n,0);
  });

  await check('trilha administrativa sem alteração de direitos ou liberação',async()=>{
    assert.equal((await root.query('SELECT count(*)::int AS n FROM eut_migration.mp_owner_settings_audit')).rows[0].n,3);
    const data=(await root.query(`SELECT count(*)::int AS n FROM public.eut_contact_purchase_intents
      WHERE state NOT IN ('prepared','expired')`)).rows[0].n;
    assert.equal(data,0);
    assert.equal((await root.query('SELECT count(*)::int AS n FROM public.eut_contact_entitlements')).rows[0].n,0);
  });

  console.log(JSON.stringify({result:'PASS',postgres:version,tests:passed,
    auditEvents:3,synthetic:true,localOnly:true,productionChanges:false,charges:false}));
}catch(error){
  console.error(`FAIL ${error?.message??String(error)}`);
  console.error(error?.stack??error);
  process.exitCode=1;
}finally{
  await Promise.allSettled(connections.map(db=>db.end()));
  if(started)await pg.stop().catch(e=>console.error(`stop error: ${e.message}`));
  await rm(databaseDir,{recursive:true,force:true});
}
