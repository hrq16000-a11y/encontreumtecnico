-- Correct an existing verified CSV-retry defect without changing the public
-- contract, access privileges, RLS, any records or suspended contacts.
-- The save RPC used to reject the same private phone before checking whether
-- this origin/source_id was an idempotent import retry. For a new or edited
-- record the exact same blocked/occupied-phone guard must still run.
DO $migration$
DECLARE
  v_definition text;
  v_old_guard text := $old$IF EXISTS (SELECT 1 FROM eut_moderation.blocked_phones b
      WHERE b.phone_digits=pg_catalog.regexp_replace(v_phone,'[^0-9]','','g')) OR
      EXISTS (SELECT 1 FROM public.eut_technician_private_contacts c WHERE c.phone_e164=v_phone)
    THEN RAISE EXCEPTION 'Contato privado já ocupado ou bloqueado' USING ERRCODE='23505'; END IF;$old$;
  v_new_guard text := $new$IF v_phone_action='replace' THEN
    IF EXISTS (SELECT 1 FROM eut_moderation.blocked_phones b
      WHERE b.phone_digits=pg_catalog.regexp_replace(v_phone,'[^0-9]','','g')) OR
      EXISTS (SELECT 1 FROM public.eut_technician_private_contacts c WHERE c.phone_e164=v_phone)
    THEN RAISE EXCEPTION 'Contato privado já ocupado ou bloqueado' USING ERRCODE='23505'; END IF;
  END IF;$new$;
  v_anchor text := $anchor$  IF v_existing.id IS NOT NULL THEN$anchor$;
BEGIN
  SELECT pg_get_functiondef(
    'public.eut_admin_technician_record_save(text,text,timestamptz,jsonb,text)'::regprocedure
  ) INTO v_definition;
  IF position(v_old_guard IN v_definition)>0
    AND position(v_anchor IN v_definition)>0
    AND position('Imported records follow the owner-authorized active default' IN v_definition)>0
  THEN
    v_definition := replace(v_definition, v_old_guard, '-- The private-phone guard now runs after the import-idempotence check.');
    v_definition := replace(v_definition, v_anchor, '  ' || v_new_guard || E'\n' || v_anchor);
    EXECUTE v_definition;
  ELSIF position('-- The private-phone guard now runs after the import-idempotence check.' IN v_definition)>0 THEN
    NULL; -- Already applied.
  ELSE
    RAISE EXCEPTION 'Unexpected admin RPC definition; existing function preserved';
  END IF;
END;
$migration$;
