-- RASCUNHO NÃO APLICADO. Somente após autorização explícita para Supabase oficial.
-- Corrige a policy existente sem alterar a moderação administrativa.
-- SQL transacional; conferir a policy exata em preflight read-only antes de usar.
BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = 'technicians'
      AND policyname = 'Owner edits back to pending' AND cmd = 'UPDATE'
      AND qual = '(auth.uid() = user_id)'
      AND with_check = '((auth.uid() = user_id) AND (status = ''pendente''::approval_status))'
  ) THEN
    RAISE EXCEPTION 'Policy do titular diferente do preflight; revisar manualmente'
      USING ERRCODE = '55000';
  END IF;
END;
$preflight$;

-- USING enxerga a linha ANTERIOR; impede suspenso -> pendente pelo titular.
-- A policy "Admin moderates" continua permitindo alterações legítimas ao admin.
ALTER POLICY "Owner edits back to pending" ON public.technicians
  USING ((auth.uid() = user_id) AND (status <> 'suspenso'::public.approval_status))
  WITH CHECK ((auth.uid() = user_id) AND (status = 'pendente'::public.approval_status));

COMMIT;

-- Reversão somente por autorização separada e após conferir as policies reais:
-- ALTER POLICY "Owner edits back to pending" ON public.technicians
--   USING (auth.uid() = user_id)
--   WITH CHECK ((auth.uid() = user_id) AND (status = 'pendente'::public.approval_status));
