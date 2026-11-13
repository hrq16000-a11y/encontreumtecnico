-- Disposable PostgreSQL fixture: selected installed trigger functions and RLS
-- retrieved read-only from the hosted EUT database; NEVER run on the hosted DB.
DROP TRIGGER fixture_guard ON public.technicians;
DROP TRIGGER fixture_services ON public.technicians;
ALTER TABLE public.technicians ADD COLUMN bio text, ADD COLUMN region text;
CREATE SCHEMA eut_profile_security;
CREATE SCHEMA eut_visibility;

CREATE OR REPLACE FUNCTION eut_profile_security.is_unsafe_public_text(raw text, strict_digits boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v text := lower(normalize(coalesce(raw,''), NFKC));
  word text;
  consecutive integer := 0;
begin
  if btrim(v) = '' then return false; end if;
  -- Bio: no digits at all, including separated over multiple lines.
  if strict_digits and v ~ '[[:digit:]]' then return true; end if;
  -- Other visible free-text: phone-like sequences even if separated by any chars.
  if not strict_digits and char_length(regexp_replace(v,'[^[:digit:]]','','g')) >= 8 then return true; end if;
  -- Contact channels, URLs, emails, handles and domains.
  if v ~ '(https?[[:space:]]*:[[:space:]]*/|www[[:space:][:punct:]]*[.]|w[[:space:][:punct:]]*w[[:space:][:punct:]]*w[[:space:][:punct:]]*[.]|wa[.]me|t[.]me|api[.]whatsapp|@[[:alnum:]_]|[[:alnum:]_-]+[[:space:]]*@[[:space:]]*[[:alnum:]_-]+|[[:alnum:]_-]+[[:space:]]*[.][[:space:]]*(com|br|net|org|info|app|site|io|me|link|tech)([^[:alpha:]]|$)|whats[[:space:]-]*app|whatsapp|wpp|zap|telegram|instagram|tiktok|facebook|telefone|celular|ligue|arroba|ponto[[:space:]]*(com|br|net)|chama[[:space:]]*(no|na)[[:space:]]*(zap|whats)|me[[:space:]]*chame)' then
     return true;
  end if;
  -- Digits written as words, split by punctuation/newlines.
  foreach word in array regexp_split_to_array(regexp_replace(v, '[^[:alpha:]]+', ' ', 'g'), '[[:space:]]+') loop
    if word in ('zero','um','uma','dois','duas','tres','três','quatro','cinco','seis','sete','oito','nove',
                'one','two','three','four','five','six','seven','eight','nine') then
      consecutive := consecutive + 1;
      if consecutive >= 5 then return true; end if;
    else
      consecutive := 0;
    end if;
  end loop;
  return false;
end $function$;

CREATE OR REPLACE FUNCTION eut_profile_security.block_unsafe_public_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if eut_profile_security.is_unsafe_public_text(new.bio,true) then
    raise exception 'Apresentação deve conter apenas texto profissional, sem números, links ou contatos'
      using errcode='23514';
  end if;
  if eut_profile_security.is_unsafe_public_text(new.display_name,false)
     or eut_profile_security.is_unsafe_public_text(new.region,false)
     or eut_profile_security.is_unsafe_public_text(new.neighborhood,false) then
    raise exception 'Dados públicos não podem conter telefones, links ou contatos'
      using errcode='23514';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION eut_migration.guard_technician_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_city text;
begin
  if new.status='aprovado'::public.approval_status then
    v_city := lower(btrim(coalesce(new.city,'')));
    if length(v_city)<2 or length(v_city)>100
       or v_city in ('brasil','brazil','a confirmar','não informado','nao informado','não definida','nao definida','unknown','undefined','null','country','n/a','-')
       or v_city ~ '^[0-9[:space:]]+$' then
      raise exception 'Municipality must be confirmed before approving technician';
    end if;
    if coalesce(cardinality(new.specialties),0)=0 then
      raise exception 'At least one reviewed specialty is required before approving technician';
    end if;
  end if;
  return new;
end
$function$;

CREATE OR REPLACE FUNCTION public.eut_validate_technician_city_and_coverage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE expected_id integer; canonical_name text; matched int;
BEGIN
 IF NEW.status = 'aprovado'::public.approval_status THEN
  SELECT m.id,m.name INTO expected_id,canonical_name FROM public.eut_ibge_municipalities m
   WHERE m.uf=NEW.state_uf AND lower(m.name)=lower(btrim(NEW.city))
   LIMIT 1;
  IF expected_id IS NULL THEN
   RAISE EXCEPTION 'Selecione um município válido do catálogo IBGE para a UF escolhida';
  END IF;
  -- Store the exact canonical city spelling, even when input casing differed.
  NEW.city := canonical_name;
  -- A base-city change invalidates any previously declared radius and list.
  -- Clear them, then the owner can confirm the new coverage explicitly.
  IF TG_OP = 'UPDATE' AND
    (OLD.city IS DISTINCT FROM NEW.city OR OLD.state_uf IS DISTINCT FROM NEW.state_uf) THEN
    NEW.coverage_city_ids := '{}'::integer[];
    NEW.service_radius_km := NULL;
  END IF;
 END IF;
 IF cardinality(NEW.coverage_city_ids)>0 THEN
  IF NEW.status <> 'aprovado'::public.approval_status THEN
   RAISE EXCEPTION 'Coverage may only be declared on a published technician profile';
  END IF;
  SELECT count(DISTINCT m.id)::int INTO matched
    FROM public.eut_ibge_municipalities m
    WHERE m.id=ANY(NEW.coverage_city_ids);
  IF matched <> cardinality(NEW.coverage_city_ids) THEN
    RAISE EXCEPTION 'Cidades de atendimento devem ser únicas e válidas no IBGE';
  END IF;
  IF NOT expected_id=ANY(NEW.coverage_city_ids) THEN
    RAISE EXCEPTION 'A cidade-base precisa constar entre as até cinco cidades declaradas';
  END IF;
 END IF;
 RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.eut_validate_technician_services()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_slug text;
  v_category text;
begin
  if cardinality(new.service_slugs) > 64 then
    raise exception 'too many technician services' using errcode='23514';
  end if;
  if exists (
    select 1 from unnest(new.service_slugs) slug
    where slug is null or length(btrim(slug)) < 2
  ) then
    raise exception 'invalid technician service' using errcode='23514';
  end if;
  if cardinality(new.service_slugs) <> (select count(distinct slug) from unnest(new.service_slugs) slug) then
    raise exception 'duplicate technician service' using errcode='23514';
  end if;
  for v_slug in select unnest(new.service_slugs) loop
    select s.category_slug into v_category
      from public.eut_service_types s
      join public.eut_service_categories c on c.slug=s.category_slug
      where s.slug=v_slug and s.active and c.active;
    if v_category is null or not (v_category=any(new.specialties)) then
      raise exception 'service must be active and belong to one selected category' using errcode='23514';
    end if;
    v_category:=null;
  end loop;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION eut_moderation.reject_restricted_publication()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if new.status = 'aprovado'::public.approval_status then
    if exists (select 1 from eut_moderation.blocked_accounts a where a.user_id=new.user_id)
      or exists (select 1 from public.eut_technician_private_contacts c
        join eut_moderation.blocked_phones b
          on b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
        where c.user_id=new.user_id)
    then
      raise exception 'Não foi possível concluir seu cadastro. Consulte o suporte.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION eut_visibility.eut_public_technician_eligible(_technician_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT EXISTS(
  SELECT 1 FROM public.technicians t
  WHERE t.id=_technician_id
  AND t.status='aprovado'::public.approval_status
  AND t.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=t.user_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.eut_technician_private_contacts c
    JOIN eut_moderation.blocked_phones b
      ON b.phone_digits=pg_catalog.regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
    WHERE c.user_id=t.user_id AND c.phone_e164 IS NOT NULL
      AND pg_catalog.regexp_replace(c.phone_e164,'[^0-9]','','g')<>''
  )
 );
$function$;


CREATE TRIGGER eut_block_public_contact_disclosure
 BEFORE INSERT OR UPDATE OF bio,display_name,region,neighborhood ON public.technicians
 FOR EACH ROW EXECUTE FUNCTION eut_profile_security.block_unsafe_public_profile();
CREATE TRIGGER eut_check_technician_services
 BEFORE INSERT OR UPDATE OF service_slugs,specialties ON public.technicians
 FOR EACH ROW EXECUTE FUNCTION public.eut_validate_technician_services();
CREATE TRIGGER eut_restrict_technician_publication
 BEFORE INSERT OR UPDATE OF status,user_id ON public.technicians
 FOR EACH ROW EXECUTE FUNCTION eut_moderation.reject_restricted_publication();
CREATE TRIGGER eut_technician_approval_quality
 BEFORE INSERT OR UPDATE OF status,city,specialties ON public.technicians
 FOR EACH ROW EXECUTE FUNCTION eut_migration.guard_technician_approval();
CREATE TRIGGER eut_technician_city_coverage_guard
 BEFORE INSERT OR UPDATE OF city,state_uf,status,coverage_city_ids ON public.technicians
 FOR EACH ROW EXECUTE FUNCTION public.eut_validate_technician_city_and_coverage();

-- These are the relevant live permissive RLS policies, before the proposed fix.
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA eut_migration,eut_profile_security,eut_visibility TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.technicians TO anon,authenticated;
GRANT SELECT ON public.eut_service_categories,public.eut_service_types,public.eut_ibge_municipalities TO anon,authenticated;
GRANT EXECUTE ON FUNCTION eut_visibility.eut_public_technician_eligible(uuid) TO anon,authenticated;
CREATE POLICY "Admin moderates" ON public.technicians FOR UPDATE TO authenticated
 USING(public.has_role(auth.uid(),'admin'::public.app_role))
 WITH CHECK(public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admin reads all" ON public.technicians FOR SELECT TO authenticated
 USING(public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Owner creates pending" ON public.technicians FOR INSERT TO authenticated
 WITH CHECK(auth.uid()=user_id AND status='pendente'::public.approval_status);
CREATE POLICY "Owner edits back to pending" ON public.technicians FOR UPDATE TO authenticated
 USING(auth.uid()=user_id)
 WITH CHECK(auth.uid()=user_id AND status='pendente'::public.approval_status);
CREATE POLICY "Owner reads own" ON public.technicians FOR SELECT TO authenticated
 USING(auth.uid()=user_id);
CREATE POLICY "Public reads approved" ON public.technicians FOR SELECT TO anon,authenticated
 USING(status='aprovado'::public.approval_status);
CREATE POLICY eut_new_technicians_not_restricted ON public.technicians FOR INSERT TO authenticated
 WITH CHECK((SELECT public.eut_account_operational()));
CREATE POLICY eut_public_visibility_anon_guard ON public.technicians FOR SELECT TO anon
 USING(status='aprovado'::public.approval_status AND eut_visibility.eut_public_technician_eligible(id));
CREATE POLICY eut_public_visibility_auth_guard ON public.technicians FOR SELECT TO authenticated
 USING(eut_visibility.eut_public_technician_eligible(id)
   OR auth.uid()=user_id OR public.has_role(auth.uid(),'admin'::public.app_role));
