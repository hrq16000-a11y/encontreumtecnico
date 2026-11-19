-- Explicit owner instruction, 2026-11-17: imported technicians are enabled
-- immediately. Claiming an account is optional. Existing suspended contacts,
-- demo protections, blocked phones, idempotence and admin audit remain intact.
-- Only removes the obsolete origin-based default-denial branch from the
-- existing audited admin RPC; it does not replace its other safety conditions.
DO $migration$
DECLARE
  v_definition text;
  v_old_guard text := $old$IF _expected_updated_at IS NULL AND _origin<>'manual' AND v_active THEN
    -- No mass activation during import; existing suspensions may be unknown.
    RAISE EXCEPTION 'Importação não pode ativar ficha automaticamente'
      USING ERRCODE='22023'; END IF;$old$;
BEGIN
  SELECT pg_get_functiondef(
    'public.eut_admin_technician_record_save(text,text,timestamptz,jsonb,text)'::regprocedure
  ) INTO v_definition;
  IF position(v_old_guard IN v_definition) > 0 THEN
    EXECUTE replace(v_definition, v_old_guard,
      '-- Imported records follow the owner-authorized active default; all other guards stay in force.');
  ELSIF position('Imported records follow the owner-authorized active default' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected admin save RPC version; no changes applied';
  END IF;
END;
$migration$;
