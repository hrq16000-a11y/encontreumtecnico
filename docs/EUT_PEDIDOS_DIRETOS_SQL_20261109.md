# Pedidos diretos consentidos — banco e contrato

O script abaixo será aplicado via conector Supabase ao projeto EUT externo, sem alterar os arquivos `supabase/migrations/` do Lovable. Suas verificações estão na PR e nas políticas RLS.

```sql
-- Encontre um Técnico: consentimento explícito para compartilhar UM pedido com UM técnico.
-- Migration applied externally in Supabase; do not add to Lovable-generated migrations.
-- No automatic dispatch, SMS, telephone release, payment or change to prior private requests.
create table if not exists public.eut_direct_request_consents (
  request_id uuid primary key references public.service_requests(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  technician_id uuid not null references public.technicians(id) on delete cascade,
  shared_at timestamptz not null default now()
);
create index if not exists eut_direct_request_consents_client_date_idx
  on public.eut_direct_request_consents(client_id, shared_at desc);
create index if not exists eut_direct_request_consents_technician_date_idx
  on public.eut_direct_request_consents(technician_id, shared_at desc);
alter table public.eut_direct_request_consents enable row level security;

revoke all on public.eut_direct_request_consents from public, anon, authenticated;
grant select on public.eut_direct_request_consents to authenticated;

create policy "Client reads own voluntary shares"
on public.eut_direct_request_consents for select to authenticated
using (client_id = (select auth.uid()));

create policy "Technician reads shares addressed to own approved profile"
on public.eut_direct_request_consents for select to authenticated
using (exists (
  select 1 from public.technicians t
  where t.id = technician_id and t.user_id = (select auth.uid())
    and t.status = 'aprovado'::public.approval_status
));

create policy "Technician reads only explicitly shared direct requests"
on public.service_requests for select to authenticated
using (
  status = 'aberta'::public.request_status and
  exists (
    select 1 from public.eut_direct_request_consents s
    join public.technicians t on t.id = s.technician_id
    where s.request_id = service_requests.id
      and s.client_id = service_requests.client_id
      and s.technician_id = service_requests.technician_id
      and t.user_id = (select auth.uid())
      and t.status = 'aprovado'::public.approval_status
  )
);

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

revoke all on function public.eut_share_direct_request(uuid) from public, anon;
grant execute on function public.eut_share_direct_request(uuid) to authenticated;
```

Critérios: nenhum pedido privado antigo é enviado; compartilhamento depende de sessão validada, perfil aprovado e clique explícito; apenas o técnico proprietário pode ler; máximo de três novos envios por cliente em 24 horas; cancelamento remove acesso ao conteúdo por RLS; sem telefone, e-mail, cobrança ou dispatch.
