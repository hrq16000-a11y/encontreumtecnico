-- Admin-only: phone is an ordinary field, never masked or timed out in the admin UI.
-- Existing authenticated/confirmed admin checks remain; public paid contact flow is untouched.
-- Suspended contacts remain suspended and still readable by the owner.
begin;

CREATE OR REPLACE FUNCTION public.eut_admin_unified_contact(_record_key text, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
  if v_phone is null then
    return jsonb_build_object('ok', true, 'available', false,
      'contact_suspended', v_contact_suspended);
  end if;

  -- Administrative reads are ordinary field reads, not paid-contact disclosure.
  -- Keep legacy reason-based consultation audit if a reason is provided.
  if _reason is not null then
    insert into eut_moderation.contact_audit
      (actor_id, action, reference_id, phone_last4, reason)
    values (v_actor, 'reveal_phone', v_key, right(v_phone, 4), v_reason);
  end if;

  -- A suspension controls customer contact, never admin field visibility.
  return jsonb_build_object('ok', true, 'available', true,
    'phone', v_phone, 'contact_suspended', v_contact_suspended);
end;
$function$;
CREATE OR REPLACE FUNCTION public.eut_admin_contacts_dashboard(_search text DEFAULT ''::text, _filter text DEFAULT 'todos'::text, _page integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_search text := left(lower(btrim(coalesce(_search, ''))), 80);
  v_filter text := coalesce(_filter, 'todos');
  v_page integer := greatest(0, least(coalesce(_page, 0), 10000));
  v_total integer;
  v_rows jsonb := '[]'::jsonb;
  v_blocks jsonb := '[]'::jsonb;
  v_messages jsonb := '[]'::jsonb;
  v_audit jsonb := '[]'::jsonb;
  v_stats jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role = 'admin'::public.app_role
  ) or not exists (
    select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null
  ) then
    raise exception 'Acesso administrativo não autorizado' using errcode = '42501';
  end if;
  if v_filter not in ('todos','aprovado','pendente','suspenso','rejeitado','banidos','sem_contato')
  then raise exception 'Filtro inválido' using errcode = '22023'; end if;
  with filtered as (
    select t.id
    from public.technicians t
    left join public.profiles p on p.id=t.user_id
    left join public.eut_technician_private_contacts c on c.user_id=t.user_id
    left join auth.users a on a.id=t.user_id
    where (
      v_search = '' or lower(t.display_name) like '%'||v_search||'%'
      or lower(coalesce(p.full_name,'')) like '%'||v_search||'%'
      or lower(coalesce(a.email,'')) like '%'||v_search||'%'
      or lower(coalesce(t.city,'')) like '%'||v_search||'%'
      or t.user_id::text = v_search
      or regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
        like '%' || regexp_replace(v_search,'[^0-9]','','g') || '%'
           and regexp_replace(v_search,'[^0-9]','','g') <> ''
    ) and (
      v_filter = 'todos'
      or (v_filter in ('aprovado','pendente','suspenso','rejeitado') and t.status::text = v_filter)
      or (v_filter = 'sem_contato' and c.phone_e164 is null)
      or (v_filter = 'banidos' and (
        exists(select 1 from eut_moderation.blocked_accounts ba where ba.user_id=t.user_id)
        or exists(select 1 from eut_moderation.blocked_phones bp
          where bp.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g'))
      ))
    )
  )
  select count(*)::integer into v_total from filtered;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into v_rows from (
    select
      t.id, t.user_id, t.display_name, t.status::text as status,
      t.city, t.state_uf, t.created_at,
      a.email,
      c.phone_e164 as phone,
      case when c.phone_e164 is null then null else '•••• '||right(c.phone_e164,4) end as masked_phone,
      c.phone_e164 is not null as has_phone,
      coalesce(c.allow_paid_contact,false) as allow_paid_contact,
      exists(select 1 from eut_moderation.blocked_accounts b where b.user_id=t.user_id) as blocked_account,
      exists(select 1 from eut_moderation.blocked_phones b
        where b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')) as blocked_phone
    from public.technicians t
    join auth.users a on a.id=t.user_id
    left join public.eut_technician_private_contacts c on c.user_id=t.user_id
    where t.id in (
      select t2.id from public.technicians t2
      left join public.profiles p2 on p2.id=t2.user_id
      left join public.eut_technician_private_contacts c2 on c2.user_id=t2.user_id
      left join auth.users a2 on a2.id=t2.user_id
      where (
        v_search = '' or lower(t2.display_name) like '%'||v_search||'%'
        or lower(coalesce(p2.full_name,'')) like '%'||v_search||'%'
        or lower(coalesce(a2.email,'')) like '%'||v_search||'%'
        or lower(coalesce(t2.city,'')) like '%'||v_search||'%'
        or t2.user_id::text = v_search
        or (regexp_replace(v_search,'[^0-9]','','g') <> '' and
            regexp_replace(coalesce(c2.phone_e164,''),'[^0-9]','','g')
              like '%'||regexp_replace(v_search,'[^0-9]','','g')||'%')
      ) and (
        v_filter='todos'
        or (v_filter in ('aprovado','pendente','suspenso','rejeitado') and t2.status::text=v_filter)
        or (v_filter='sem_contato' and c2.phone_e164 is null)
        or (v_filter='banidos' and (
          exists(select 1 from eut_moderation.blocked_accounts bb where bb.user_id=t2.user_id)
          or exists(select 1 from eut_moderation.blocked_phones bb
            where bb.phone_digits=regexp_replace(coalesce(c2.phone_e164,''),'[^0-9]','','g'))
        ))
      )
    )
    order by t.created_at desc limit 20 offset v_page*20
  ) x;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.added_at desc),'[]'::jsonb)
  into v_blocks from (
    select 'telefone'::text as kind, block_id::text as ref_id,
      null::uuid as user_id, '•••• '||right(phone_digits,4) as label,
      reason_internal as reason, added_at
      from eut_moderation.blocked_phones
    union all
    select 'conta'::text, user_id::text, user_id,
      coalesce((select t.display_name from public.technicians t where t.user_id=ba.user_id), 'Conta sem perfil técnico'),
      reason_internal, added_at from eut_moderation.blocked_accounts ba
    order by added_at desc limit 100
  ) b;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc),'[]'::jsonb)
  into v_messages from (
    select id,name,email,subject,message,status,created_at from public.contact_messages
    order by created_at desc limit 40
  ) m;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb)
  into v_audit from (
    select actor_id,action,subject_user_id,phone_last4,reference_id,reason,created_at
    from eut_moderation.contact_audit order by created_at desc limit 40
  ) a;

  select jsonb_build_object(
    'total_tecnicos',(select count(*) from public.technicians),
    'aprovados',(select count(*) from public.technicians where status='aprovado'),
    'suspensos',(select count(*) from public.technicians where status='suspenso'),
    'sem_numero',(select count(*) from public.technicians t
      where not exists(select 1 from public.eut_technician_private_contacts c where c.user_id=t.user_id)),
    'numeros_restritos',(select count(*) from eut_moderation.blocked_phones),
    'contas_restritas',(select count(*) from eut_moderation.blocked_accounts),
    'mensagens_abertas',(select count(*) from public.contact_messages where status='nova')
  ) into v_stats;

  return jsonb_build_object('rows',v_rows,'blocked',v_blocks,'messages',v_messages,
    'audit',v_audit,'stats',v_stats,'total',v_total,'page',v_page);
end;
$function$;

revoke all on function public.eut_admin_unified_contact(text,text) from public, anon;
grant execute on function public.eut_admin_unified_contact(text,text) to authenticated;
revoke all on function public.eut_admin_contacts_dashboard(text,text,integer) from public, anon;
grant execute on function public.eut_admin_contacts_dashboard(text,text,integer) to authenticated;
commit;
