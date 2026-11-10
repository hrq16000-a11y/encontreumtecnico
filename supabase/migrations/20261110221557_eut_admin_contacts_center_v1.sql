-- Migration espelhada do banco EUT. Não inserir dados privados de banimento neste repositório.
alter table eut_moderation.blocked_phones
  add column if not exists block_id uuid not null default gen_random_uuid();
create unique index if not exists eut_blocked_phones_public_id on eut_moderation.blocked_phones(block_id);

create table if not exists eut_moderation.contact_audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('block_phone','unblock_phone','block_account','unblock_account','suspend_account','request_review','reveal_phone','mark_message')),
 subject_user_id uuid,
 phone_last4 text,
 reference_id text,
 reason text not null check(char_length(reason) between 5 and 500),
 created_at timestamptz not null default now()
);
create index if not exists eut_contact_audit_date on eut_moderation.contact_audit(created_at desc);
revoke all on eut_moderation.contact_audit from public,anon,authenticated;
alter table eut_moderation.contact_audit enable row level security;

CREATE OR REPLACE FUNCTION public.eut_admin_contact_action(_action text, _user_id uuid DEFAULT NULL::uuid, _phone text DEFAULT NULL::text, _block_id uuid DEFAULT NULL::uuid, _message_id uuid DEFAULT NULL::uuid, _message_status text DEFAULT NULL::text, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(_reason,''));
  v_digits text;
  v_user uuid;
  v_phone_tail text;
  v_reference text;
  v_affected integer := 0;
begin
  if v_actor is null or not exists(
    select 1 from public.user_roles r where r.user_id=v_actor and r.role='admin'::public.app_role
  ) then raise exception 'Acesso administrativo não autorizado' using errcode='42501'; end if;
  if char_length(v_reason) not between 8 and 500 then
    raise exception 'Informe justificativa interna de 8 a 500 caracteres' using errcode='22023';
  end if;

  if _action='block_phone' then
    v_digits:=regexp_replace(coalesce(_phone,''),'[^0-9]','','g');
    if left(v_digits,2)<>'55' and length(v_digits) in (10,11) then v_digits:='55'||v_digits; end if;
    if v_digits !~ '^55[1-9]{2}[2-9][0-9]{7,8}$' then
      raise exception 'Informe telefone brasileiro completo com DDD' using errcode='22023'; end if;
    if exists (
      select 1 from public.eut_technician_private_contacts c
      join public.user_roles r on r.user_id=c.user_id and r.role='admin'::public.app_role
      where regexp_replace(c.phone_e164,'[^0-9]','','g')=v_digits
    ) then raise exception 'Conta administrativa protegida' using errcode='42501'; end if;
    insert into eut_moderation.blocked_phones(phone_digits,reason_internal)
      values(v_digits,v_reason) on conflict(phone_digits) do nothing;
    insert into eut_moderation.blocked_accounts(user_id,reason_internal)
      select c.user_id,v_reason from public.eut_technician_private_contacts c
      where regexp_replace(c.phone_e164,'[^0-9]','','g')=v_digits
      on conflict(user_id) do nothing;
    update public.technicians t set status='suspenso',coverage_city_ids='{}'::integer[],
      service_radius_km=null, reviewed_at=now(),updated_at=now()
      where exists(select 1 from public.eut_technician_private_contacts c
        where c.user_id=t.user_id and regexp_replace(c.phone_e164,'[^0-9]','','g')=v_digits);
    update public.eut_technician_private_contacts c set allow_paid_contact=false,updated_at=now()
      where regexp_replace(c.phone_e164,'[^0-9]','','g')=v_digits;
    v_phone_tail:=right(v_digits,4);
    v_reference:='telefone restrito';
  elsif _action='unblock_phone' then
    if _block_id is null then raise exception 'Registro restrito obrigatório'; end if;
    delete from eut_moderation.blocked_phones where block_id=_block_id
      returning right(phone_digits,4) into v_phone_tail;
    if v_phone_tail is null then raise exception 'Registro não encontrado'; end if;
    v_reference:=_block_id::text;
  elsif _action='block_account' then
    if _user_id is null then raise exception 'Conta obrigatória'; end if;
    if _user_id=v_actor or exists(select 1 from public.user_roles
      where user_id=_user_id and role='admin'::public.app_role)
      then raise exception 'Conta administrativa protegida' using errcode='42501'; end if;
    if not exists(select 1 from auth.users where id=_user_id) then raise exception 'Conta não encontrada'; end if;
    insert into eut_moderation.blocked_accounts(user_id,reason_internal)
      values(_user_id,v_reason) on conflict(user_id) do nothing;
    insert into eut_moderation.blocked_phones(phone_digits,reason_internal)
      select regexp_replace(c.phone_e164,'[^0-9]','','g'),v_reason
      from public.eut_technician_private_contacts c where c.user_id=_user_id
      on conflict(phone_digits) do nothing;
    update public.technicians t set status='suspenso',coverage_city_ids='{}'::integer[],
      service_radius_km=null,reviewed_at=now(),updated_at=now() where user_id=_user_id;
    update public.eut_technician_private_contacts c
      set allow_paid_contact=false,updated_at=now() where user_id=_user_id;
    v_user:=_user_id;v_reference:='conta restrita';
  elsif _action='unblock_account' then
    if _user_id is null then raise exception 'Conta obrigatória'; end if;
    delete from eut_moderation.blocked_accounts where user_id=_user_id;
    get diagnostics v_affected=row_count;
    if v_affected=0 then raise exception 'Conta não consta na lista'; end if;
    v_user:=_user_id;v_reference:='restrição da conta retirada; telefones permanecem restritos';
  elsif _action='suspend_account' then
    if _user_id is null or _user_id=v_actor or exists(select 1 from public.user_roles
      where user_id=_user_id and role='admin'::public.app_role)
      then raise exception 'Não pode suspender essa conta'; end if;
    update public.technicians t set status='suspenso',coverage_city_ids='{}'::integer[],
      service_radius_km=null,reviewed_at=now(),updated_at=now() where user_id=_user_id;
    get diagnostics v_affected=row_count;
    if v_affected=0 then raise exception 'Perfil não encontrado'; end if;
    update public.eut_technician_private_contacts
      set allow_paid_contact=false,updated_at=now() where user_id=_user_id;
    v_user:=_user_id;v_reference:='perfil suspenso sem liberar contato';
  elsif _action='request_review' then
    if _user_id is null then raise exception 'Conta obrigatória'; end if;
    if exists(select 1 from eut_moderation.blocked_accounts b where b.user_id=_user_id) or
      exists(select 1 from public.eut_technician_private_contacts c
        join eut_moderation.blocked_phones b
          on b.phone_digits=regexp_replace(c.phone_e164,'[^0-9]','','g')
        where c.user_id=_user_id)
      then raise exception 'Retire as restrições antes de abrir revisão'; end if;
    update public.technicians set status='pendente',coverage_city_ids='{}'::integer[],
      service_radius_km=null,reviewed_at=now(),updated_at=now()
      where user_id=_user_id and status='suspenso'::public.approval_status;
    get diagnostics v_affected=row_count;
    if v_affected=0 then raise exception 'Somente perfis suspensos podem voltar à revisão'; end if;
    v_user:=_user_id;v_reference:='perfil em revisão; sem aprovação automática';
  elsif _action='mark_message' then
    if _message_id is null or _message_status not in ('nova','respondida','arquivada')
      then raise exception 'Mensagem e situação válidas obrigatórias'; end if;
    update public.contact_messages set status=_message_status,updated_at=now()
      where id=_message_id;
    get diagnostics v_affected=row_count;
    if v_affected=0 then raise exception 'Mensagem não encontrada'; end if;
    v_reference:=_message_id::text || ':' || _message_status;
  else
    raise exception 'Operação não permitida' using errcode='22023';
  end if;
  insert into eut_moderation.contact_audit
    (actor_id,action,subject_user_id,phone_last4,reference_id,reason)
  values (v_actor,_action,v_user,v_phone_tail,v_reference,v_reason);
  return jsonb_build_object('ok',true,'action',_action);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.eut_admin_contact_reveal(_user_id uuid, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v_phone text; v_reason text:=btrim(coalesce(_reason,''));
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='admin'::public.app_role
  ) then raise exception 'Acesso administrativo não autorizado' using errcode='42501'; end if;
  if char_length(v_reason) not between 8 and 500 then raise exception 'Justifique o acesso ao telefone'; end if;
  select c.phone_e164 into v_phone
    from public.eut_technician_private_contacts c where c.user_id=_user_id;
  if v_phone is null then return jsonb_build_object('ok',false,'reason','sem_numero'); end if;
  insert into eut_moderation.contact_audit
    (actor_id,action,subject_user_id,phone_last4,reason)
  values(auth.uid(),'reveal_phone',_user_id,right(v_phone,4),v_reason);
  return jsonb_build_object('ok',true,'phone',v_phone);
end;
$function$
;

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
    select action,subject_user_id,phone_last4,reference_id,reason,created_at
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
$function$
;

revoke all on function public.eut_admin_contacts_dashboard(text,text,integer) from public,anon,authenticated;
revoke all on function public.eut_admin_contact_action(text,uuid,text,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.eut_admin_contact_reveal(uuid,text) from public,anon,authenticated;
grant execute on function public.eut_admin_contacts_dashboard(text,text,integer) to authenticated;
grant execute on function public.eut_admin_contact_action(text,uuid,text,uuid,uuid,text,text) to authenticated;
grant execute on function public.eut_admin_contact_reveal(uuid,text) to authenticated;
