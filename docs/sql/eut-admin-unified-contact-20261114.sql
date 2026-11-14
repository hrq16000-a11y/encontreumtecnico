-- Administrative contact consultation across the existing technician catalogue.
-- No bulk data changes. Run once on the dedicated EUT Supabase project only.
-- Authenticated callers must also be confirmed admins; every revealed number is audited.
begin;

create function public.eut_admin_unified_contact(
  _record_key text,
  _reason text default null
) returns jsonb
language plpgsql security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_actor uuid := auth.uid();
  v_key text := btrim(coalesce(_record_key, ''));
  v_reason text := btrim(coalesce(_reason, ''));
  v_phone text;
  v_contact_suspended boolean := false;
begin
  if v_actor is null
     or not public.has_role(v_actor, 'admin'::public.app_role)
     or not exists (
       select 1 from auth.users u
       where u.id = v_actor and u.email_confirmed_at is not null
     ) then
    raise exception 'Admin confirmado obrigatório' using errcode = '42501';
  end if;

  if length(v_key) not between 5 and 120 then
    raise exception 'Referência de técnico inválida' using errcode = '22023';
  end if;
  if _reason is not null and length(v_reason) not between 8 and 500 then
    raise exception 'Justifique o acesso ao contato' using errcode = '22023';
  end if;

  if v_key ~* '^portal:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select c.phone_e164 into v_phone
      from public.technicians t
      join public.eut_technician_private_contacts c on c.user_id = t.user_id
     where t.id = substring(v_key from 8)::uuid;
  elsif v_key ~ '^wp:candidate:[0-9]{1,18}$' then
    select l.contact_phone into v_phone
      from eut_migration.legacy_directory l
     where l.source_key = 'wordpress_20261108'
       and l.kind = 'candidate'
       and l.wp_post_id = substring(v_key from 14)::bigint;
  elsif v_key ~* '^registry:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select c.phone_e164, c.contact_suspended into v_phone, v_contact_suspended
      from eut_moderation.admin_technician_records r
      join eut_moderation.admin_technician_record_contacts c on c.record_id = r.id
     where r.id = substring(v_key from 10)::uuid;
  else
    return jsonb_build_object('ok', true, 'available', false);
  end if;

  v_phone := nullif(btrim(v_phone), '');
  if v_phone is null or v_contact_suspended then
    return jsonb_build_object('ok', true, 'available', false);
  end if;

  if _reason is null then
    return jsonb_build_object('ok', true, 'available', true);
  end if;

  insert into eut_moderation.contact_audit
    (actor_id, action, reference_id, phone_last4, reason)
  values (v_actor, 'reveal_phone', v_key, right(v_phone, 4), v_reason);

  return jsonb_build_object('ok', true, 'available', true, 'phone', v_phone);
end;
$function$;

revoke all on function public.eut_admin_unified_contact(text, text) from public, anon;
grant execute on function public.eut_admin_unified_contact(text, text) to authenticated;
commit;
