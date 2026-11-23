-- Snapshot somente do CODIGO de oito RPCs publicas auditadas em 20/11/2026.
-- Sem dados, usuarios, telefones, tokens ou credenciais do Supabase oficial.
-- Uso EXCLUSIVO em Postgres local descartavel para testar a proposta #357.

BEGIN;
CREATE OR REPLACE FUNCTION public.eut_admin_enable_my_technician_role()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado'
      USING ERRCODE = '42501';
  END IF;

  -- Caller must own a confirmed, active identity. The email and roles come
  -- from the auth database, NEVER from user-controlled metadata or arguments.
  IF eut_migration.confirmed_current_email() IS NULL THEN
    RAISE EXCEPTION 'Confirme sua identidade antes de habilitar o perfil técnico'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.eut_account_operational() THEN
    RAISE EXCEPTION 'Conta restrita. Consulte o suporte'
      USING ERRCODE = '42501';
  END IF;

  -- Preserve the existing single-purpose choice between customer/technician.
  -- This function is specifically for admin + technician, not a universal
  -- role escalation endpoint. Never grant admin to a customer/technician.
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role = 'cliente'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Uma conta cliente exige tratamento separado para ativar o perfil técnico'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (v_uid, 'tecnico'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- The existing role trigger rejects blocked accounts and blocked phones.
  -- If auditing fails, the transaction must roll back the new role too.
  IF v_inserted = 1 THEN
    INSERT INTO public.eut_admin_management_log (
      actor_id, target_type, target_key, action, reason, before_state, after_state
    ) VALUES (
      v_uid, 'account', v_uid::text, 'self_enable_technician',
      'Administrador confirmou a ativação do próprio perfil profissional',
      jsonb_build_object('admin', true, 'tecnico', false),
      jsonb_build_object('admin', true, 'tecnico', true)
    );
  END IF;

  IF NOT public.has_role(v_uid, 'admin'::public.app_role)
    OR NOT public.has_role(v_uid, 'tecnico'::public.app_role) THEN
    RAISE EXCEPTION 'Permissões não foram confirmadas'
      USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'state', CASE WHEN v_inserted = 1 THEN 'activated' ELSE 'already_active' END,
    'admin_preserved', true, 'technician_enabled', true
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.eut_my_private_contact()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_user uuid := auth.uid();
  v_phone text;
  v_allowed boolean;
begin
  if v_user is null or eut_migration.confirmed_current_email() is null or
    not exists(select 1 from public.user_roles r where r.user_id=v_user and r.role='tecnico'::public.app_role)
  then raise exception 'confirmed technician session required'; end if;

  select c.phone_e164,c.allow_paid_contact into v_phone,v_allowed
    from public.eut_technician_private_contacts c where c.user_id=v_user;
  return jsonb_build_object(
    'has_number',v_phone is not null,
    'phone',v_phone,
    'allow_paid_contact',coalesce(v_allowed,false)
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.eut_publish_my_technician(_display_name text, _state_uf text, _city text, _specialties text[], _service_slugs text[], _neighborhood text DEFAULT NULL::text, _region text DEFAULT NULL::text, _bio text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(_display_name,''));
  v_uf text := upper(btrim(coalesce(_state_uf,'')));
  v_city text := btrim(coalesce(_city,''));
  v_neighborhood text := nullif(btrim(coalesce(_neighborhood,'')),'');
  v_region text := nullif(btrim(coalesce(_region,'')),'');
  v_bio text := nullif(btrim(coalesce(_bio,'')),'');
  v_prior_status public.approval_status;
  v_id uuid;
begin
  if v_uid is null
     or eut_migration.confirmed_current_email() is null
     or not exists(select 1 from public.user_roles r
                   where r.user_id=v_uid and r.role='tecnico'::public.app_role)
  then raise exception 'confirmed technician session required'; end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'public display name must have between 2 and 80 characters'; end if;
  if v_uf not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then
    raise exception 'valid state UF required'; end if;
  if char_length(v_city)<2 or char_length(v_city)>80
      or lower(v_city) in ('brasil','brazil','a confirmar','não informado','nao informado',
        'não definida','nao definida','unknown','undefined','null','country','n/a','-','online','remoto')
      or v_city ~ '^[0-9[:space:]]+$' then
    raise exception 'real municipality must be supplied by technician'; end if;
  if v_neighborhood is not null and (char_length(v_neighborhood)<2 or char_length(v_neighborhood)>100) then
    raise exception 'invalid neighborhood'; end if;
  if v_region is not null and char_length(v_region)>120 then raise exception 'region is too long'; end if;
  if v_bio is not null and char_length(v_bio)>2000 then raise exception 'description is too long'; end if;

  if _specialties is null or cardinality(_specialties)=0 or cardinality(_specialties)>12
    or exists(select 1 from unnest(_specialties) as item where item is null or length(btrim(item))<2)
    or cardinality(_specialties)<>(select count(distinct item) from unnest(_specialties) as item)
  then raise exception 'select valid categories'; end if;
  if exists (
    select 1 from unnest(_specialties) as item
    left join public.eut_service_categories c on c.slug=item and c.active
    where c.slug is null
  ) then raise exception 'some selected categories are not active'; end if;

  if _service_slugs is null or cardinality(_service_slugs)=0 or cardinality(_service_slugs)>64
    or exists(select 1 from unnest(_service_slugs) as item where item is null or length(btrim(item))<2)
    or cardinality(_service_slugs)<>(select count(distinct item) from unnest(_service_slugs) as item)
  then raise exception 'select valid specific services'; end if;
  if exists (
    select 1 from unnest(_service_slugs) as item
    left join public.eut_service_types s on s.slug=item and s.active
    left join public.eut_service_categories c on c.slug=s.category_slug and c.active
    where s.slug is null or c.slug is null or not (s.category_slug=any(_specialties))
  ) then raise exception 'service must be active and match selected category'; end if;

  select t.status into v_prior_status
  from public.technicians t where t.user_id=v_uid for update;
  if v_prior_status in ('rejeitado'::public.approval_status,'suspenso'::public.approval_status) then
    return jsonb_build_object('state','bloqueado_por_seguranca');
  end if;

  insert into public.profiles(id,full_name)
  values(v_uid,v_name)
  on conflict(id) do nothing;

  insert into public.technicians(
    user_id,display_name,state_uf,city,neighborhood,region,bio,specialties,service_slugs,status)
  values(v_uid,v_name,v_uf,v_city,v_neighborhood,v_region,v_bio,
      _specialties,_service_slugs,'aprovado'::public.approval_status)
  on conflict(user_id) do update
    set display_name=excluded.display_name,state_uf=excluded.state_uf,
      city=excluded.city,neighborhood=excluded.neighborhood,
      region=excluded.region,bio=excluded.bio,
      specialties=excluded.specialties,service_slugs=excluded.service_slugs,
      status='aprovado'::public.approval_status,
      reviewed_at=null,
      updated_at=now()
    where public.technicians.status not in (
      'rejeitado'::public.approval_status,'suspenso'::public.approval_status
    )
  returning id into v_id;
  if v_id is null then raise exception 'cannot publish restricted profile'; end if;
  return jsonb_build_object('state','publicado','technician_id',v_id);
end;
$function$;
CREATE OR REPLACE FUNCTION public.eut_remove_my_private_contact()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v_user uuid := auth.uid();
begin
  if v_user is null or eut_migration.confirmed_current_email() is null or
    not exists(select 1 from public.user_roles r where r.user_id=v_user and r.role='tecnico'::public.app_role)
  then raise exception 'confirmed technician session required'; end if;
  delete from public.eut_technician_private_contacts where user_id=v_user;
  return true;
end;
$function$;
CREATE OR REPLACE FUNCTION public.eut_save_my_private_contact(_phone text, _allow_paid_contact boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_user uuid := auth.uid();
  v_digits text;
  v_national text;
  v_phone text;
begin
  if v_user is null or eut_migration.confirmed_current_email() is null or
    not exists(select 1 from public.user_roles r where r.user_id=v_user and r.role='tecnico'::public.app_role)
  then raise exception 'confirmed technician session required'; end if;
  if _allow_paid_contact is null then raise exception 'contact sharing preference required'; end if;
  if _phone is null or length(_phone)>40 then raise exception 'invalid Brazilian WhatsApp'; end if;
  v_digits := regexp_replace(_phone,'[^0-9]','','g');
  if left(v_digits,2)='55' and length(v_digits) in (12,13) then
    v_national:=substr(v_digits,3);
  else
    v_national:=v_digits;
  end if;
  if v_national !~ '^[1-9]{2}[2-9][0-9]{7,8}$' then
    raise exception 'provide a valid Brazilian number with area code';
  end if;
  v_phone:='+55'||v_national;

  insert into public.eut_technician_private_contacts(user_id,phone_e164,allow_paid_contact,updated_at)
  values(v_user,v_phone,_allow_paid_contact,now())
  on conflict(user_id) do update set
    phone_e164=excluded.phone_e164,
    allow_paid_contact=excluded.allow_paid_contact,
    updated_at=now();
  return jsonb_build_object('saved',true,'allow_paid_contact',_allow_paid_contact);
end;
$function$;
CREATE OR REPLACE FUNCTION public.eut_set_my_presence(_available boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or eut_migration.confirmed_current_email() is null
    or not exists (
      select 1 from public.user_roles r
      where r.user_id=v_uid and r.role='tecnico'::public.app_role
    ) then
    raise exception 'confirmed technician session required';
  end if;
  if _available is null then raise exception 'presence flag required'; end if;
  -- Only an actual published profile may claim online presence.
  if not exists (
    select 1 from public.technicians t
    where t.user_id=v_uid and t.status='aprovado'::public.approval_status
  ) then
    raise exception 'publish your complete profile before going online';
  end if;

  insert into public.eut_technician_presence
    (user_id,available,last_seen_at,updated_at)
  values (v_uid,_available,case when _available then now() else null end,now())
  on conflict (user_id) do update set
    available=excluded.available,
    last_seen_at=excluded.last_seen_at,
    updated_at=now();
  return case when _available then 'online' else 'offline' end;
end;
$function$;
CREATE OR REPLACE FUNCTION public.eut_set_my_technician_avatar(_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_uid uuid:=auth.uid(); v_id uuid;
BEGIN
 IF v_uid IS NULL OR eut_migration.confirmed_current_email() IS NULL
   OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=v_uid
     AND r.role='tecnico'::public.app_role)
 THEN RAISE EXCEPTION 'verified technician account required'; END IF;
 IF _path IS NOT NULL AND (
  _path !~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$'
  OR split_part(_path,'/',2)<>v_uid::text
  OR NOT EXISTS (SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='eut-technician-avatars' AND o.name=_path)
 ) THEN RAISE EXCEPTION 'avatar must be an uploaded image owned by the current technician'; END IF;
 UPDATE public.technicians t SET avatar_path=_path, updated_at=now()
  WHERE t.user_id=v_uid AND t.status='aprovado'::public.approval_status
  RETURNING t.id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'published profile required'; END IF;
 RETURN pg_catalog.jsonb_build_object('state','salvo');
END; $function$;
CREATE OR REPLACE FUNCTION public.eut_set_my_technician_coverage(_radius_km integer, _city_ids integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_uid uuid:=auth.uid(); v_id uuid; v_codes integer[]; n integer;
BEGIN
 IF v_uid IS NULL OR eut_migration.confirmed_current_email() IS NULL
   OR NOT EXISTS (SELECT 1 FROM public.user_roles r
     WHERE r.user_id=v_uid AND r.role='tecnico'::public.app_role)
 THEN RAISE EXCEPTION 'verified technician account required'; END IF;
 IF _radius_km IS NOT NULL AND _radius_km NOT IN (5,10,20,30,50,75,100,150,200,300)
 THEN RAISE EXCEPTION 'invalid service radius'; END IF;
 v_codes:=coalesce(_city_ids,'{}'::integer[]);
 n:=cardinality(v_codes);
 IF n<1 OR n>5 OR array_position(v_codes,NULL) IS NOT NULL
 THEN RAISE EXCEPTION 'select between one and five validated municipalities'; END IF;
 UPDATE public.technicians t
 SET coverage_city_ids=v_codes, service_radius_km=_radius_km, updated_at=now()
 WHERE t.user_id=v_uid AND t.status='aprovado'::public.approval_status
 RETURNING t.id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'published profile required'; END IF;
 RETURN pg_catalog.jsonb_build_object('state','salvo','technician_id',v_id);
END; $function$;
COMMIT;

