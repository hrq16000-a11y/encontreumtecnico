-- SOMENTE fixture PostgreSQL descartável; nunca executar no Supabase oficial.
-- Parte do estado já criado pela fixture operacional sintética.
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.technicians TO authenticated;
CREATE POLICY "Owner reads own" ON public.technicians FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admin reads all" ON public.technicians FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owner edits back to pending" ON public.technicians FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) AND
    (status NOT IN ('suspenso'::public.approval_status, 'rejeitado'::public.approval_status)))
  WITH CHECK ((auth.uid() = user_id) AND (status = 'pendente'::public.approval_status));
CREATE POLICY "Admin moderates" ON public.technicians FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Valida somente o contrato atual: não altera a policy já protegida.
\i docs/sql/eut-technician-suspension-resubmission-guard-proposal-20261120.sql

-- Ambos os titulares suspensos tentam status pendente: nenhum UPDATE possível.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',
 '20000000-0000-4000-8000-000000000002',true);
DO $test$
DECLARE changed integer;
BEGIN
 UPDATE public.technicians SET status='pendente'
 WHERE id='10000000-0000-4000-8000-000000000002';
 GET DIAGNOSTICS changed = ROW_COUNT;
 IF changed <> 0 THEN RAISE EXCEPTION 'titular restaurou primeiro suspenso'; END IF;
END;
$test$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',
 '20000000-0000-4000-8000-000000000003',true);
DO $test$
DECLARE changed integer;
BEGIN
 UPDATE public.technicians SET status='pendente'
 WHERE id='10000000-0000-4000-8000-000000000003';
 GET DIAGNOSTICS changed = ROW_COUNT;
 IF changed <> 0 THEN RAISE EXCEPTION 'titular restaurou segundo suspenso'; END IF;
END;
$test$;
ROLLBACK;

-- A versão oficial também impede restaurar uma ficha rejeitada pelo titular.
-- A transição de aprovado para rejeitado aqui ocorre apenas no fixture e é revertida.
BEGIN;
UPDATE public.technicians SET status='rejeitado'
WHERE id='10000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',
 '20000000-0000-4000-8000-000000000001',true);
DO $test$
DECLARE changed integer;
BEGIN
 UPDATE public.technicians SET status='pendente'
 WHERE id='10000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS changed = ROW_COUNT;
 IF changed <> 0 THEN RAISE EXCEPTION 'titular restaurou ficha rejeitada'; END IF;
END;
$test$;
ROLLBACK;

-- Titular não suspenso pode fazer a transição já prevista pela policy original.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',
 '20000000-0000-4000-8000-000000000001',true);
DO $test$
DECLARE changed integer; rejected boolean:=false;
BEGIN
 UPDATE public.technicians SET status='pendente'
 WHERE id='10000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS changed = ROW_COUNT;
 IF changed <> 1 THEN RAISE EXCEPTION 'edição legítima do titular bloqueada'; END IF;
 -- Status aprovado não pode ser autoatribuído pelo titular.
 BEGIN
   UPDATE public.technicians SET status='aprovado'
   WHERE id='10000000-0000-4000-8000-000000000001';
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'titular se autoaprovou'; END IF;
END;
$test$;
ROLLBACK;

-- Um titular distinto não pode restaurar a ficha de outro.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',
 '20000000-0000-4000-8000-000000000004',true);
DO $test$
DECLARE changed integer;
BEGIN
 UPDATE public.technicians SET status='pendente'
 WHERE id='10000000-0000-4000-8000-000000000002';
 GET DIAGNOSTICS changed = ROW_COUNT;
 IF changed <> 0 THEN RAISE EXCEPTION 'terceiro restaurou suspenso'; END IF;
END;
$test$;
ROLLBACK;

-- A policy "Admin moderates" continua a autorizar o proprietário autenticado.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',
 '30000000-0000-4000-8000-000000000001',true);
DO $test$
DECLARE changed integer;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
   RAISE EXCEPTION 'fixture sem admin legítimo'; END IF;
 UPDATE public.technicians SET status='pendente'
 WHERE status='suspenso';
 GET DIAGNOSTICS changed = ROW_COUNT;
 IF changed <> 2 THEN RAISE EXCEPTION 'moderação administrativa bloqueada'; END IF;
END;
$test$;
ROLLBACK;

-- Pós-testes: nenhuma alteração canônica, identidade ou contato sintético.
DO $test$
BEGIN
 IF (SELECT count(*) FROM public.technicians WHERE status='suspenso')<>2 OR
    (SELECT count(*) FROM public.technicians WHERE status='aprovado')<>1 OR
    (SELECT count(*) FROM public.eut_fixture_role_assignments)<>6 THEN
   RAISE EXCEPTION 'fixture não foi restaurado';
 END IF;
END;
$test$;
