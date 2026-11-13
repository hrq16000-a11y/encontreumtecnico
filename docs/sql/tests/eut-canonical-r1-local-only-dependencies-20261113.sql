-- ONLY for the unlinked, disposable Supabase CLI stack in GitHub Actions.
-- Apply AFTER the six Git migrations and BEFORE the existing R1 proposal.
-- No historical migration replay, hosted project, real account, or real phone.
-- Reproduces just the referenced R1 dependencies from the inspected schema.
BEGIN;

CREATE SCHEMA eut_moderation;
CREATE SCHEMA eut_migration;
CREATE SCHEMA eut_profile_security;
CREATE SCHEMA eut_visibility;

ALTER TABLE public.technicians
  ADD COLUMN state_uf text,
  ADD COLUMN neighborhood text,
  ADD COLUMN service_slugs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN coverage_city_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN service_radius_km integer,
  ADD COLUMN public_slug text;

-- The current deployed schema requires a stable non-null slug. This is the
-- relevant function/trigger contract already represented in the PR fixture.
CREATE FUNCTION eut_migration.technician_public_slug_base(
  _name text, _city text, _uf text
) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(nullif(trim(both '-' FROM left(
    regexp_replace(translate(lower(concat_ws('-',
      nullif(trim(_name), ''),nullif(trim(_city),''),nullif(trim(_uf),''))),
      'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9]+','-','g'),80)),''),'tecnico');
$$;
CREATE FUNCTION eut_migration.assign_technician_public_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_base text;
BEGIN
  IF TG_OP='UPDATE' AND OLD.public_slug IS NOT NULL THEN
    NEW.public_slug:=OLD.public_slug; RETURN NEW;
  END IF;
  v_base:=eut_migration.technician_public_slug_base(
    NEW.display_name,NEW.city,NEW.state_uf);
  IF EXISTS(SELECT 1 FROM public.technicians t
      WHERE t.public_slug=v_base AND t.id<>NEW.id) THEN
    v_base:=left(v_base,80)||'-'||left(replace(NEW.id::text,'-',''),12);
  END IF;
  NEW.public_slug:=v_base; RETURN NEW;
END $$;
-- The real GoTrue foundation test already created one synthetic Auth-owned
-- technician in this same local stack. Backfill only that disposable row.
UPDATE public.technicians SET public_slug =
  eut_migration.technician_public_slug_base(display_name,city,state_uf)
  ||'-'||left(replace(id::text,'-',''),12);
CREATE TRIGGER eut_assign_technician_public_slug
  BEFORE INSERT OR UPDATE OF public_slug,display_name,city,state_uf
  ON public.technicians FOR EACH ROW
  EXECUTE FUNCTION eut_migration.assign_technician_public_slug();
ALTER TABLE public.technicians ALTER COLUMN public_slug SET NOT NULL;
ALTER TABLE public.technicians ADD CONSTRAINT eut_public_slug_format
  CHECK(public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(public_slug)<=96);
CREATE UNIQUE INDEX eut_local_technician_slug_unique
  ON public.technicians(public_slug);

-- Referenced taxonomy is empty except for explicitly synthetic fixtures.
CREATE TABLE public.eut_ibge_municipalities(
  id integer PRIMARY KEY, name text NOT NULL, uf text NOT NULL);
CREATE TABLE public.eut_service_categories(
  slug text PRIMARY KEY,active boolean NOT NULL);
CREATE TABLE public.eut_service_types(
  slug text PRIMARY KEY,category_slug text NOT NULL
    REFERENCES public.eut_service_categories(slug),active boolean NOT NULL);
INSERT INTO public.eut_ibge_municipalities VALUES
  (4106902,'Curitiba','PR'),(4125506,'São José dos Pinhais','PR');
INSERT INTO public.eut_service_categories VALUES
  ('computadores',true),('desativada',false);
INSERT INTO public.eut_service_types VALUES
  ('manutencao-pc','computadores',true);
ALTER TABLE public.eut_ibge_municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eut_service_types ENABLE ROW LEVEL SECURITY;

CREATE TABLE eut_moderation.blocked_accounts(
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),reason_internal text NOT NULL);
CREATE TABLE eut_moderation.blocked_phones(
  phone_digits text PRIMARY KEY,reason_internal text NOT NULL);
ALTER TABLE eut_moderation.blocked_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_moderation.blocked_phones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA eut_moderation FROM PUBLIC,anon,authenticated;
-- Fixture only; this number cannot refer to a real user in this stack.
INSERT INTO eut_moderation.blocked_phones VALUES
  ('5541999997070','Synthetic-only R1 blocked contact');

CREATE FUNCTION public.eut_account_operational() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'pg_catalog' AS $$
  SELECT auth.uid() IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM eut_moderation.blocked_accounts b
      WHERE b.user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.eut_account_operational()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.eut_account_operational()
  TO authenticated;

CREATE TABLE public.eut_admin_management_log(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  target_type text NOT NULL,target_key text NOT NULL,
  action text NOT NULL,reason text NOT NULL,
  before_state jsonb NOT NULL,after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.eut_admin_management_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.eut_admin_management_log TO authenticated;
CREATE POLICY eut_local_admin_audit_read
  ON public.eut_admin_management_log FOR SELECT TO authenticated
  USING(public.has_role(auth.uid(),'admin'::public.app_role)
        AND public.eut_account_operational());

-- Legacy private contacts exist in hosted metadata but not in the six Git
-- migrations. Provide the minimal no-grant table for the live eligibility
-- predicate; R1 imported phones use the distinct private 1:1 table in proposal.
CREATE TABLE public.eut_technician_private_contacts(
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  phone_e164 text NOT NULL,allow_paid_contact boolean NOT NULL DEFAULT false);
ALTER TABLE public.eut_technician_private_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.eut_technician_private_contacts
  FROM PUBLIC,anon,authenticated;

-- This is the deployed predicate for existing Auth-owned approved profiles.
-- Imported Auth-less pending technicians must remain out of the public API.
CREATE FUNCTION eut_visibility.eut_public_technician_eligible(_technician_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'pg_catalog' AS $$
  SELECT EXISTS(SELECT 1 FROM public.technicians t
    WHERE t.id=_technician_id AND t.status='aprovado'::public.approval_status
      AND t.user_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts b
        WHERE b.user_id=t.user_id)
      AND NOT EXISTS(SELECT 1
        FROM public.eut_technician_private_contacts c
        JOIN eut_moderation.blocked_phones b
          ON b.phone_digits=regexp_replace(c.phone_e164,'[^0-9]','','g')
        WHERE c.user_id=t.user_id AND c.phone_e164 IS NOT NULL));
$$;
REVOKE ALL ON FUNCTION eut_visibility.eut_public_technician_eligible(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA eut_visibility TO anon,authenticated;
GRANT EXECUTE ON FUNCTION eut_visibility.eut_public_technician_eligible(uuid)
  TO anon,authenticated;

-- Mirror the preexisting unsafe-public-text dependency the R1 RPC invokes.
CREATE FUNCTION eut_profile_security.is_unsafe_public_text(
  raw text,strict_digits boolean DEFAULT false
) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = 'pg_catalog' AS $$
DECLARE v text:=lower(normalize(coalesce(raw,''),NFKC));
        word text; consecutive integer:=0;
BEGIN
  IF btrim(v)='' THEN RETURN false; END IF;
  IF strict_digits AND v ~ '[[:digit:]]' THEN RETURN true; END IF;
  IF NOT strict_digits AND
     char_length(regexp_replace(v,'[^[:digit:]]','','g'))>=8
  THEN RETURN true; END IF;
  IF v ~ '(https?[[:space:]]*:[[:space:]]*/|www[[:space:][:punct:]]*[.]|wa[.]me|t[.]me|api[.]whatsapp|@[[:alnum:]_]|[[:alnum:]_-]+[[:space:]]*@[[:space:]]*[[:alnum:]_-]+|[[:alnum:]_-]+[[:space:]]*[.][[:space:]]*(com|br|net|org|info|app|site|io|me|link|tech)([^[:alpha:]]|$)|whats[[:space:]-]*app|whatsapp|wpp|zap|telegram|instagram|tiktok|facebook|telefone|celular|ligue|arroba|ponto[[:space:]]*(com|br|net)|chama[[:space:]]*(no|na)[[:space:]]*(zap|whats)|me[[:space:]]chame)'
  THEN RETURN true; END IF;
  FOREACH word IN ARRAY regexp_split_to_array(
    regexp_replace(v,'[^[:alpha:]]+',' ','g'),'[[:space:]]+') LOOP
    IF word IN ('zero','um','uma','dois','duas','tres','três','quatro',
                'cinco','seis','sete','oito','nove','one','two','three',
                'four','five','six','seven','eight','nine') THEN
      consecutive:=consecutive+1;
      IF consecutive>=5 THEN RETURN true; END IF;
    ELSE consecutive:=0; END IF;
  END LOOP;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION eut_profile_security.is_unsafe_public_text(text,boolean)
  FROM PUBLIC,anon,authenticated;

COMMIT;
