-- STAGING PROPOSAL ONLY. Not installed in the dedicated Supabase project.
-- No SQL execution or migration from CI against a hosted database.
-- Owner-only, expiring, account-scoped technician registration drafts.
BEGIN;

CREATE OR REPLACE FUNCTION public.eut_valid_technician_draft(_draft jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = 'pg_catalog'
AS $function$
DECLARE k text; value jsonb; maxlen integer; item jsonb; limit_items integer;
BEGIN
  IF _draft IS NULL OR jsonb_typeof(_draft) <> 'object'
    OR octet_length(_draft::text) > 7500 THEN RETURN false; END IF;
  FOR k IN SELECT jsonb_object_keys(_draft) LOOP
    IF k NOT IN ('display_name','state_uf','city','neighborhood','region','bio',
                 'specialties','service_slugs','base_city_ibge_id') THEN
      RETURN false;
    END IF;
  END LOOP;
  FOR k IN SELECT unnest(ARRAY['display_name','state_uf','city','neighborhood','region','bio']) LOOP
    IF _draft ? k THEN
      value := _draft->k;
      maxlen := CASE k
        WHEN 'display_name' THEN 80
        WHEN 'state_uf' THEN 2
        WHEN 'city' THEN 80
        WHEN 'neighborhood' THEN 100
        WHEN 'region' THEN 120
        ELSE 2000 END;
      IF jsonb_typeof(value) <> 'string' OR char_length(value #>> '{}') > maxlen THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;
  IF _draft ? 'base_city_ibge_id' AND jsonb_typeof(_draft->'base_city_ibge_id') <> 'null' THEN
    IF jsonb_typeof(_draft->'base_city_ibge_id') <> 'number'
      OR (_draft->>'base_city_ibge_id') !~ '^[1-9][0-9]{6}$' THEN RETURN false; END IF;
  END IF;
  FOR k IN SELECT unnest(ARRAY['specialties','service_slugs']) LOOP
    IF _draft ? k THEN
      value := _draft->k;
      IF jsonb_typeof(value) <> 'array' THEN RETURN false; END IF;
      limit_items := CASE WHEN k='specialties' THEN 12 ELSE 64 END;
      IF jsonb_array_length(value) > limit_items THEN RETURN false; END IF;
      FOR item IN SELECT jsonb_array_elements(value) LOOP
        IF jsonb_typeof(item) <> 'string'
          OR char_length(item #>> '{}') NOT BETWEEN 1 AND 80 THEN RETURN false; END IF;
      END LOOP;
    END IF;
  END LOOP;
  RETURN true;
END;
$function$;

CREATE TABLE public.eut_technician_drafts (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  draft jsonb NOT NULL CHECK (public.eut_valid_technician_draft(draft)),
  step smallint NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 3),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + INTERVAL '30 days'),
  CHECK (expires_at > updated_at)
);

CREATE OR REPLACE FUNCTION public.eut_guard_technician_draft()
RETURNS trigger LANGUAGE plpgsql SET search_path='pg_catalog'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.expires_at <= clock_timestamp() THEN
      RAISE EXCEPTION 'Draft expired; delete and start a new draft' USING ERRCODE='22023'; END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'Draft ownership is immutable' USING ERRCODE='42501'; END IF;
    IF NEW.revision IS DISTINCT FROM OLD.revision THEN
      RAISE EXCEPTION 'Draft changed in another session' USING ERRCODE='40001'; END IF;
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := 1;
  END IF;
  -- Client cannot extend the retention period by inventing its own timestamps.
  NEW.updated_at := clock_timestamp();
  NEW.expires_at := NEW.updated_at + INTERVAL '30 days';
  RETURN NEW;
END;
$function$;

CREATE TRIGGER eut_guard_technician_draft
  BEFORE INSERT OR UPDATE ON public.eut_technician_drafts
  FOR EACH ROW EXECUTE FUNCTION public.eut_guard_technician_draft();

ALTER TABLE public.eut_technician_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eut_technician_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.eut_technician_drafts TO authenticated;

-- Authenticated is necessary but not sufficient: ownership AND technical role.
-- Owner SELECT includes expired rows so that owner DELETE can remove them.
-- Recover only with expires_at > now(), and schedule privileged physical cleanup.
CREATE POLICY eut_draft_owner_select ON public.eut_technician_drafts
  FOR SELECT TO authenticated
  USING (owner_id=(SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()),'tecnico'::public.app_role));
CREATE POLICY eut_draft_owner_insert ON public.eut_technician_drafts
  FOR INSERT TO authenticated
  WITH CHECK (owner_id=(SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()),'tecnico'::public.app_role));
CREATE POLICY eut_draft_owner_update ON public.eut_technician_drafts
  FOR UPDATE TO authenticated
  USING (owner_id=(SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()),'tecnico'::public.app_role))
  WITH CHECK (owner_id=(SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()),'tecnico'::public.app_role));
CREATE POLICY eut_draft_owner_delete ON public.eut_technician_drafts
  FOR DELETE TO authenticated
  USING (owner_id=(SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()),'tecnico'::public.app_role));

COMMENT ON TABLE public.eut_technician_drafts IS
  'Private unsent technician registration drafts. Owner-only RLS; recover only unexpired rows. Expired records cannot be updated, may be deleted by owner, and require scheduled physical cleanup before production rollout.';

COMMIT;
