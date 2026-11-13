-- GUARDED R1 ROLLBACK PROPOSAL. NEVER run in hosted Supabase without
-- backup, separately authorized owner approval, and a reviewed migration plan.
-- Tested only on the SECOND isolated synthetic PostgreSQL database.
BEGIN;
DO $guard$
DECLARE v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin'::public.app_role)
    OR NOT EXISTS(SELECT 1 FROM auth.users u
      WHERE u.id=v_actor AND u.email_confirmed_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Verified owner identity required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians WHERE user_id IS NULL)
    OR EXISTS(SELECT 1 FROM eut_moderation.catalog_provenance)
    OR EXISTS(SELECT 1 FROM eut_moderation.catalog_private_contacts)
    OR EXISTS(SELECT 1 FROM public.eut_admin_management_log
      WHERE action IN ('catalog_created','catalog_enabled_changed'))
 THEN RAISE EXCEPTION
   'ROLLBACK BLOCKED: preserve all catalog records, contacts and audit evidence'
   USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM public.technicians
    WHERE user_id IS NULL OR display_name IS NULL OR city IS NULL)
 THEN RAISE EXCEPTION 'Legacy NOT NULL cannot be restored' USING ERRCODE='23502'; END IF;
 INSERT INTO public.eut_admin_management_log(
    actor_id,target_type,target_key,action,reason,before_state,after_state)
 VALUES(v_actor,'system','catalog-r1','catalog_r1_rollback',
    'Reversão sintética controlada sem cadastros novos',
    jsonb_build_object('r1_installed',true),
    jsonb_build_object('r1_removed',true,'legacy_preserved',true));
END;
$guard$;
-- Restore exactly the original 3 deployed RLS policy contracts, before
-- dropping the new operational column used by the proposed filters.
DROP POLICY eut_catalog_direct_insert_requires_owner ON public.technicians;
DROP POLICY "Public reads approved" ON public.technicians;
DROP POLICY eut_public_visibility_anon_guard ON public.technicians;
DROP POLICY eut_public_visibility_auth_guard ON public.technicians;
CREATE POLICY "Public reads approved" ON public.technicians AS PERMISSIVE FOR SELECT TO anon,authenticated USING ((status = 'aprovado'::approval_status));
CREATE POLICY "eut_public_visibility_anon_guard" ON public.technicians AS RESTRICTIVE FOR SELECT TO anon USING (((status = 'aprovado'::approval_status) AND eut_visibility.eut_public_technician_eligible(id)));
CREATE POLICY "eut_public_visibility_auth_guard" ON public.technicians AS RESTRICTIVE FOR SELECT TO authenticated USING ((eut_visibility.eut_public_technician_eligible(id) OR (auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));
DROP FUNCTION public.eut_admin_catalog_list(integer,integer,text,uuid[]);
DROP FUNCTION public.eut_admin_catalog_set_enabled(uuid,timestamptz,boolean,text);
DROP FUNCTION public.eut_admin_catalog_import_batch(jsonb,text);
DROP FUNCTION public.eut_admin_catalog_upsert(text,text,text,integer,text,text,text);
DROP TRIGGER eut_catalog_operational_guard ON public.technicians;
DROP FUNCTION eut_moderation.audit_catalog_operational_edit();
DROP TABLE eut_moderation.catalog_provenance;
DROP TABLE eut_moderation.catalog_private_contacts;
ALTER TABLE public.technicians
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN display_name SET NOT NULL,
  ALTER COLUMN city SET NOT NULL,
  DROP COLUMN catalog_enabled,
  DROP COLUMN catalog_origin,
  DROP COLUMN ddd_hint;
COMMIT;
