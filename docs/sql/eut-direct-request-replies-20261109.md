# Resposta privada ao pedido consentido — migração Supabase EUT

Esta migração adiciona **uma resposta textual por pedido** exclusivamente para o profissional escolhido e confirmado. Pedidos anteriores continuam privados; somente pedidos com consentimento explícito são elegíveis. O contrato não libera telefone, e-mail, pagamento, aceite de serviço ou compartilhamento público. Respostas rejeitam formatos comuns de contato e rua/número; **isso não substitui moderação futura nem garante identificar toda informação pessoal**.

```sql
-- Private replies to individually consented customer requests.
-- Existing WordPress, paid-contact entitlements and customer records are unchanged.
-- Reject obvious contact disclosures in BOTH customer shares and technician replies.
create or replace function eut_migration.has_sensitive_direct_contact(_value text)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $contact$
  select coalesce(_value,'') ~* 
  '(https?://|www[.]|wa[.]me/|[[:alnum:]_.%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}|(^|[^[:digit:]])([+]?[[:digit:]][[:space:]()./-]*){9,}([^[:digit:]]|$)|(^|[^[:alpha:]])(rua|avenida|travessa|alameda|estrada|av[.])[[:space:]]+[^,.[:cntrl:]]{2,60}[[:space:]]+[[:digit:]]{1,5}([^[:digit:]]|$))';
$contact$;
revoke all on function eut_migration.has_sensitive_direct_contact(text) from public, anon, authenticated;

create or replace function public.eut_share_direct_request(_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  v_client uuid := auth.uid();
  v_request public.service_requests%rowtype;
begin
  if v_client is null or eut_migration.confirmed_current_email() is null
     or not exists (
       select 1 from public.user_roles r
       where r.user_id = v_client and r.role = 'cliente'::public.app_role
     ) then
    raise exception 'verified client account required';
  end if;
  if _request_id is null then raise exception 'request id required'; end if;

  -- Serialise direct-send quota even for simultaneous requests.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_client::text, 2319));

  select * into v_request from public.service_requests
    where id = _request_id and client_id = v_client for update;
  if not found then raise exception 'request unavailable'; end if;
  if v_request.status <> 'aberta'::public.request_status
     or v_request.technician_id is null
     or not exists (
       select 1 from public.technicians t
       where t.id = v_request.technician_id
         and t.status = 'aprovado'::public.approval_status
     ) then
    raise exception 'request cannot be shared with this technician';
  end if;
  -- The free opt-in message must not become an unbilled phone/address channel.
  if eut_migration.has_sensitive_direct_contact(
      v_request.title || ' ' || v_request.description || ' ' ||
      coalesce(v_request.city,'') || ' ' || coalesce(v_request.region,'')
     ) then
    raise exception 'remove phone, email, URL or complete street address before sharing';
  end if;
  if exists (select 1 from public.eut_direct_request_consents s
             where s.request_id = _request_id) then
    return pg_catalog.jsonb_build_object('status','enviado');
  end if;
  if (select count(*) from public.eut_direct_request_consents s
      where s.client_id = v_client and s.shared_at > now() - interval '24 hours') >= 3 then
    raise exception 'daily direct-request limit reached';
  end if;

  insert into public.eut_direct_request_consents(request_id,client_id,technician_id)
    values(_request_id,v_client,v_request.technician_id);
  return pg_catalog.jsonb_build_object('status','enviado');
end
$fn$;

create table if not exists public.eut_direct_request_replies (
  request_id uuid primary key references public.service_requests(id) on delete cascade,
  technician_user_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 20 and 700),
  created_at timestamptz not null default now()
);

alter table public.eut_direct_request_replies enable row level security;
revoke all on table public.eut_direct_request_replies from public, anon, authenticated;
grant select (request_id, body, created_at) on public.eut_direct_request_replies to authenticated;

create policy "Client reads reply only to their voluntarily shared request"
on public.eut_direct_request_replies for select to authenticated
using (
  exists (
    select 1 from public.eut_direct_request_consents s
    where s.request_id=eut_direct_request_replies.request_id
      and s.client_id=(select auth.uid())
  )
);

create policy "Technician reads only their own reply"
on public.eut_direct_request_replies for select to authenticated
using (technician_user_id=(select auth.uid()));

create or replace function public.eut_respond_to_direct_request(_request_id uuid, _body text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $reply$
declare
  v_user uuid := auth.uid();
  v_body text := btrim(coalesce(_body,''));
  v_request public.service_requests%rowtype;
begin
  if v_user is null or eut_migration.confirmed_current_email() is null or not exists (
    select 1 from public.user_roles r
    where r.user_id=v_user and r.role='tecnico'::public.app_role
  ) then
    raise exception 'verified technician session required';
  end if;

  if _request_id is null then raise exception 'request id required'; end if;
  if char_length(v_body) < 20 or char_length(v_body) > 700 then
    raise exception 'reply must be between 20 and 700 characters';
  end if;
  if eut_migration.has_sensitive_direct_contact(v_body) then
    raise exception 'reply cannot contain phone, email, URL or complete street address';
  end if;

  -- Lock request to serialize with customer cancellation. A technician is
  -- allowed to answer only a still-open request with explicit opt-in consent.
  select r.* into v_request
  from public.service_requests r
  join public.eut_direct_request_consents s
    on s.request_id=r.id
    and s.client_id=r.client_id
    and s.technician_id=r.technician_id
  join public.technicians t on t.id=s.technician_id
  where r.id=_request_id
    and r.status='aberta'::public.request_status
    and t.status='aprovado'::public.approval_status
    and t.user_id=v_user
  for update of r;

  if not found then raise exception 'request not addressed to this technician'; end if;

  if exists (select 1 from public.eut_direct_request_replies a
             where a.request_id=_request_id) then
    return pg_catalog.jsonb_build_object('status','ja_respondido');
  end if;

  insert into public.eut_direct_request_replies(request_id,technician_user_id,body)
    values(_request_id,v_user,v_body);

  return pg_catalog.jsonb_build_object('status','respondido');
end
$reply$;

revoke all on function public.eut_respond_to_direct_request(uuid,text) from public,anon;
grant execute on function public.eut_respond_to_direct_request(uuid,text) to authenticated;

```

As regras RLS, privilégio por coluna e função com checagem de sessão são verificadas após aplicação. O script reforça também a RPC de compartilhamento já existente.
