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

-- Rejeitado: OWNER não pode editar pela função SECURITY DEFINER, embora
-- haja uma linha operacional existente. ADMIN com motivo pode editar e auditar.
-- Todo o cenário é revertido: status, versão, perfil e log voltam ao fixture.
BEGIN;
UPDATE public.technicians SET status='rejeitado'
 WHERE id='10000000-0000-4000-8000-000000000001'
   AND status='aprovado';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
DO $rejected_owner$
DECLARE
 t uuid:='10000000-0000-4000-8000-000000000001';
 v jsonb; denied boolean:=false;
BEGIN
 v:=public.eut_technician_operations_get(t);
 IF v->'profile' IS NULL THEN RAISE EXCEPTION 'fixture rejeitado sem perfil'; END IF;
 BEGIN
   PERFORM public.eut_technician_operations_save(
     t,v->'profile',(v->>'updated_at')::timestamptz,NULL);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'titular rejeitado editou via SECURITY DEFINER'; END IF;
 IF public.eut_technician_operations_get(t) IS DISTINCT FROM v THEN
   RAISE EXCEPTION 'tentativa rejeitada alterou perfil ou versao'; END IF;
END
$rejected_owner$;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
DO $rejected_admin$
DECLARE
 t uuid:='10000000-0000-4000-8000-000000000001';
 v jsonb; saved jsonb; denied boolean:=false;
BEGIN
 IF (SELECT count(*) FROM public.eut_admin_management_log)<>2 THEN
   RAISE EXCEPTION 'tentativa rejeitada criou auditoria indevida'; END IF;
 v:=public.eut_technician_operations_get(t);
 BEGIN
   PERFORM public.eut_technician_operations_save(
     t,v->'profile',(v->>'updated_at')::timestamptz,NULL);
 EXCEPTION WHEN invalid_parameter_value THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'admin editou rejeitado sem motivo'; END IF;
 saved:=public.eut_technician_operations_save(
   t,v->'profile',(v->>'updated_at')::timestamptz,
   'Ajuste administrativo motivado para homologacao isolada');
 IF saved->>'ok'<>'true' THEN RAISE EXCEPTION 'admin motivado recusado em rejeitado'; END IF;
 IF (SELECT count(*) FROM public.eut_admin_management_log
   WHERE action='technician_operations_admin_updated')<>2 THEN
   RAISE EXCEPTION 'falta auditoria da edicao administrativa rejeitada'; END IF;

END
$rejected_admin$;
-- A tabela canônica não tem SELECT direto para authenticated nesta fixture.
-- A condição de moderação é verificada pelo usuário privilegiado do CI,
-- nunca concedendo acesso adicional ao titular ou ao administrador via API.
RESET ROLE;
DO $check_status$
BEGIN
 IF (SELECT status FROM public.technicians
     WHERE id='10000000-0000-4000-8000-000000000001')<>'rejeitado' THEN
   RAISE EXCEPTION 'admin alterou moderacao ao editar condicoes'; END IF;
END
$check_status$;
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
