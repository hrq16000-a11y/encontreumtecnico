-- EUT P0: cópia literal da definição de public.eut_publish_my_technician
-- devolvida por pg_catalog.pg_get_functiondef em 21/11/2026.
-- INSTALAR EXCLUSIVAMENTE NO SUPABASE LOCAL DESCARTÁVEL.
-- Não modificar o corpo da função para fazê-lo passar nos testes.
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
     or NOT public.eut_account_operational()
     or not exists(select 1 from public.user_roles r
                   where r.user_id=v_uid and r.role='tecnico'::public.app_role)
  then raise exception 'authenticated technician session required'; end if;

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
