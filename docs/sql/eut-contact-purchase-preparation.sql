-- Database contract already installed in Supabase EUT.
-- For reproducibility only. Review before inclusion in a generated migration.
-- No processor, webhook or payment activation is provided by this file.
create table if not exists public.eut_contact_purchase_intents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  technician_id uuid not null references public.technicians(id) on delete cascade,
  access_date date not null,
  quoted_price_cents integer not null check (quoted_price_cents in (999,2999)),
  currency text not null default 'BRL' check (currency='BRL'),
  state text not null default 'prepared' check (state in
    ('prepared','provider_created','paid','expired','cancelled')),
  provider text,
  provider_reference text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check(expires_at>created_at)
);
create index if not exists eut_purchase_intents_client_day_idx
  on public.eut_contact_purchase_intents(client_id,access_date,state);
create index if not exists eut_purchase_intents_tech_idx
  on public.eut_contact_purchase_intents(technician_id,created_at desc);
alter table public.eut_contact_purchase_intents enable row level security;
revoke all on public.eut_contact_purchase_intents from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.eut_prepare_contact_purchase(_technician_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_client uuid := auth.uid();
  v_now timestamptz := now();
  v_local timestamp := now() at time zone 'America/Sao_Paulo';
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_price integer;
  v_entitlements integer := 0;
  v_active_orders integer := 0;
  v_existing record;
  v_id uuid;
  v_expiry timestamptz;
begin
  if v_client is null or eut_migration.confirmed_current_email() is null
    or not exists(
      select 1 from public.user_roles r
      where r.user_id=v_client and r.role='cliente'::public.app_role
    ) then
    raise exception 'confirmed client session required';
  end if;
  if _technician_id is null then
    return jsonb_build_object('state','contato_indisponivel','payment_available',false);
  end if;
  if not exists(
    select 1 from public.technicians t
    join public.eut_technician_private_contacts c on c.user_id=t.user_id
    where t.id=_technician_id and t.status='aprovado'::public.approval_status
      and c.allow_paid_contact and c.phone_e164 is not null
  ) then
    return jsonb_build_object('state','contato_indisponivel','payment_available',false);
  end if;

  -- Atomically reserve at most two pending opportunities per client/day.
  -- A trusted PSP callback will need to re-check entitlements and the actual
  -- provider transaction before transforming a reservation into paid access.
  perform pg_advisory_xact_lock(
    hashtextextended('eut-contact-day:'||v_client::text||':'||v_day::text,0)
  );

  -- Only expire local-only prepared records. Provider-created transactions
  -- require a gateway status check before their slot can be released.
  update public.eut_contact_purchase_intents i
     set state='expired',updated_at=v_now
   where i.client_id=v_client and i.access_date=v_day
     and i.state='prepared' and i.expires_at<=v_now;

  if exists(
    select 1 from public.eut_contact_entitlements e
    where e.client_id=v_client and e.access_date=v_day
      and e.technician_id=_technician_id
  ) then
    return jsonb_build_object('state','contato_ja_adquirido','payment_available',false);
  end if;

  select i.id,i.quoted_price_cents,i.expires_at into v_existing
  from public.eut_contact_purchase_intents i
  where i.client_id=v_client and i.technician_id=_technician_id
    and i.access_date=v_day
    and i.state in ('prepared','provider_created')
    and i.expires_at>v_now
  order by i.created_at desc limit 1;
  if found then
    return jsonb_build_object(
      'state','preparado_sem_gateway',
      'order_id',v_existing.id,
      'quoted_price_cents',v_existing.quoted_price_cents,
      'currency','BRL',
      'expires_at',v_existing.expires_at,
      'payment_available',false,
      'contact_released',false
    );
  end if;

  select count(*)::integer into v_entitlements
  from public.eut_contact_entitlements e
  where e.client_id=v_client and e.access_date=v_day;

  select count(*)::integer into v_active_orders
  from public.eut_contact_purchase_intents i
  where i.client_id=v_client and i.access_date=v_day
    and i.state in ('prepared','provider_created')
    and i.expires_at>v_now;
  if v_entitlements+v_active_orders>=2 then
    return jsonb_build_object('state','limite_diario_atingido','payment_available',false);
  end if;
  -- Failed or abandoned attempts can be retried, but avoid unbounded writes.
  if (
    select count(*) from public.eut_contact_purchase_intents i
    where i.client_id=v_client and i.access_date=v_day
  ) >= 10 then
    return jsonb_build_object('state','muitas_tentativas','payment_available',false);
  end if;

  v_price := case
    when v_local::time>=time '09:00' and v_local::time<time '18:00'
    then 999 else 2999 end;
  v_expiry:=v_now+interval '15 minutes';
  insert into public.eut_contact_purchase_intents
    (client_id,technician_id,access_date,quoted_price_cents,expires_at)
  values (v_client,_technician_id,v_day,v_price,v_expiry)
  returning id into v_id;

  return jsonb_build_object(
    'state','preparado_sem_gateway',
    'order_id',v_id,
    'quoted_price_cents',v_price,
    'currency','BRL',
    'expires_at',v_expiry,
    'payment_available',false,
    'contact_released',false
  );
end;
$function$;
revoke all on function public.eut_prepare_contact_purchase(uuid) from public,anon;
grant execute on function public.eut_prepare_contact_purchase(uuid) to authenticated;
