-- Homologação do escopo de sessão em PostgreSQL isolado: identidades sintéticas.
-- Não se trata de JWT emitido por um servidor Supabase Auth real.

-- Terceiro com papel técnico verdadeiro não pode ler nem editar a ficha de T.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',true);
SELECT set_config('eut.fixture.role','admin',true); -- tentativa de forjar admin
SELECT set_config('request.jwt.claims','{"role":"authenticated","user_metadata":{"role":"admin"}}',true);
DO $$
DECLARE target uuid:='10000000-0000-4000-8000-000000000001'; denied boolean;
BEGIN
 IF public.has_role(auth.uid(),'admin'::public.app_role) THEN
   RAISE EXCEPTION 'papel falso foi aceito'; END IF;
 denied:=false;
 BEGIN PERFORM public.eut_technician_operations_get(target);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'outro tecnico leu ficha privada'; END IF;
 denied:=false;
 BEGIN PERFORM public.eut_technician_operations_save(target,'{}'::jsonb,NULL,NULL);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'outro tecnico editou ficha'; END IF;
 denied:=false;
 BEGIN PERFORM * FROM eut_profile_ops.technician_operations;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'papel autenticado acessou tabela diretamente'; END IF;
END $$;
ROLLBACK;

-- Cliente com metadata maliciosa não consegue usar edição administrativa.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
SELECT set_config('eut.fixture.role','admin',true);
SELECT set_config('request.jwt.claims','{"role":"authenticated","app_metadata":{"role":"admin"}}',true);
DO $$
DECLARE target uuid:='10000000-0000-4000-8000-000000000001'; denied boolean:=false;
BEGIN
 IF public.has_role(auth.uid(),'admin'::public.app_role) OR
    public.has_role(auth.uid(),'tecnico'::public.app_role) THEN
   RAISE EXCEPTION 'cliente elevou papel por claim'; END IF;
 BEGIN PERFORM public.eut_technician_operations_save(target,'{}'::jsonb,NULL,'Tentativa de edição');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'cliente gravou perfil alheio'; END IF;
END $$;
ROLLBACK;

-- Os dois titulares suspensos ainda têm papel técnico, mas NÃO podem salvar.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
DO $$
DECLARE target uuid:='10000000-0000-4000-8000-000000000002'; denied boolean:=false;
BEGIN
 IF NOT public.has_role(auth.uid(),'tecnico'::public.app_role) THEN
   RAISE EXCEPTION 'fixture suspenso sem papel tecnico'; END IF;
 IF public.eut_account_operational() THEN RAISE EXCEPTION 'conta suspensa operacional'; END IF;
 BEGIN PERFORM public.eut_technician_operations_save(target,'{}'::jsonb,NULL,NULL);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'suspenso gravou'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
DO $$
DECLARE target uuid:='10000000-0000-4000-8000-000000000003'; denied boolean:=false;
BEGIN
 IF public.eut_account_operational() THEN RAISE EXCEPTION 'segundo suspenso operacional'; END IF;
 BEGIN PERFORM public.eut_technician_operations_save(target,'{}'::jsonb,NULL,NULL);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'segundo suspenso gravou'; END IF;
END $$;
ROLLBACK;

-- O titular relê a edição administrativa e recebe conflito ao tentar regravar versão velha.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE target uuid:='10000000-0000-4000-8000-000000000001';
 v jsonb; old_at timestamptz; denied boolean:=false;
BEGIN
 v:=public.eut_technician_operations_get(target);
 IF v->'profile'->>'transport_mode'<>'motorcycle' OR
    (v->'profile'->>'eta_outside_minutes')::integer<>60 THEN
   RAISE EXCEPTION 'releitura da edição admin divergente'; END IF;
 old_at:=(v->>'updated_at')::timestamptz - interval '1 second';
 BEGIN PERFORM public.eut_technician_operations_save(target,v->'profile',old_at,NULL);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'conflito de versão não recusado'; END IF;
END $$;
ROLLBACK;

-- Depois das recusas: um único registro; 2 suspensos; 2 logs válidos; papéis intactos.
DO $$ BEGIN
 IF (SELECT count(*) FROM eut_profile_ops.technician_operations)<>1 OR
    (SELECT count(*) FROM public.technicians WHERE status='suspenso')<>2 OR
    (SELECT count(*) FROM public.eut_admin_management_log)<>2 OR
    (SELECT count(*) FROM public.eut_fixture_role_assignments)<>6 OR
    (SELECT count(*) FROM public.eut_fixture_blocked_accounts)<>2 THEN
    RAISE EXCEPTION 'teste de acesso alterou dados ou auditoria'; END IF;
END $$;
