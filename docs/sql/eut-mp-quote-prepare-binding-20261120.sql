-- PROPOSTA PARA REVISÃO: NÃO EXECUTAR NO SUPABASE OFICIAL.
-- Captura de preço/versionamento no servidor. Sem gateway, cobrança ou direitos.
-- Pré-condições levantadas em leitura no projeto EUT em 20/11/2026.
BEGIN;

DO $preflight$
BEGIN
  IF to_regprocedure('public.eut_contact_access_quote(uuid)') IS NULL
    OR to_regprocedure('public.eut_prepare_contact_purchase(uuid)') IS NULL
    OR to_regprocedure('eut_migration.mp_quote_snapshot_at(timestamp with time zone)') IS NULL
    OR to_regclass('public.eut_contact_purchase_intents') IS NULL
    OR to_regclass('eut_migration.mp_owner_settings') IS NULL
  THEN
    RAISE EXCEPTION 'Preflight de integração MP incompleto' USING ERRCODE='P0001';
  END IF;
  IF md5(pg_get_functiondef('public.eut_contact_access_quote(uuid)'::regprocedure))
      <> 'bace159c188370479a3439cc9a056815'
    OR md5(pg_get_functiondef('public.eut_prepare_contact_purchase(uuid)'::regprocedure))
      <> 'be6b4a3105cd7bf7124ffe147c3d86ce'
  THEN
    RAISE EXCEPTION 'RPC oficial mudou; reavaliar antes de substituir'
      USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='eut_contact_purchase_intents'
      AND c.relrowsecurity
  ) OR has_table_privilege('anon','public.eut_contact_purchase_intents','SELECT')
    OR has_table_privilege('authenticated','public.eut_contact_purchase_intents','SELECT')
    OR has_table_privilege('authenticated','public.eut_contact_purchase_intents','INSERT')
    OR has_function_privilege('anon','public.eut_contact_access_quote(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.eut_prepare_contact_purchase(uuid)','EXECUTE')
  THEN
    RAISE EXCEPTION 'RLS ou grants oficiais divergentes' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    WHERE con.conrelid='public.eut_contact_purchase_intents'::regclass
      AND con.conname='eut_contact_purchase_intents_quoted_price_cents_check'
      AND pg_get_constraintdef(con.oid,true) =
        'CHECK (quoted_price_cents = ANY (ARRAY[999, 2999]))'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='eut_contact_purchase_intents'
      AND column_name='pricing_version'
  ) THEN
    RAISE EXCEPTION 'Contrato da tabela mudou; verificar preservação de dados'
      USING ERRCODE='P0001';
  END IF;
END;
$preflight$;

-- Mantém todas as reservas existentes. Permite novos preços cadastrados pelo
-- proprietário sem alterar moeda, estados, chaves, RLS ou contatos privados.
ALTER TABLE public.eut_contact_purchase_intents
  DROP CONSTRAINT eut_contact_purchase_intents_quoted_price_cents_check;
ALTER TABLE public.eut_contact_purchase_intents
  ADD CONSTRAINT eut_contact_purchase_intents_quoted_price_cents_check
  CHECK (quoted_price_cents BETWEEN 100 AND 99900);
ALTER TABLE public.eut_contact_purchase_intents
  ADD COLUMN pricing_version bigint CHECK (pricing_version>0);
COMMENT ON COLUMN public.eut_contact_purchase_intents.pricing_version IS
  'Versão da tarifa no momento do pré-pedido; NULL para reservas legadas.';

-- RPCs recriadas a partir de pg_get_functiondef oficial, preservando
-- autenticação, checagem de contato, lock e responses de legado.

CREATE OR REPLACE FUNCTION public.eut_contact_access_quote(_technician_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_client uuid := auth.uid();
  v_clock timestamp := now() at time zone 'America/Sao_Paulo';
  v_terms jsonb;
  v_daily_limit integer;
  v_count integer;
  v_reserved integer;
  v_contact_ready boolean;
begin
  if v_client is null or eut_migration.confirmed_current_email() is null
     or not exists (
       select 1 from public.user_roles r
       where r.user_id=v_client and r.role='cliente'::public.app_role
     ) then raise exception 'confirmed client login required'; end if;
  if _technician_id is null or not exists (
    select 1 from public.technicians t
    where t.id=_technician_id and t.status='aprovado'::public.approval_status
  ) then raise exception 'professional profile unavailable'; end if;

  v_contact_ready := exists (
    select 1 from public.technicians t
    join public.eut_technician_private_contacts c on c.user_id=t.user_id
    where t.id=_technician_id and t.status='aprovado'::public.approval_status
      and c.allow_paid_contact and c.phone_e164 is not null
  );
  v_terms := eut_migration.mp_quote_snapshot_at(now());
  v_daily_limit := (v_terms->>'daily_contact_limit')::integer;
  select count(*)::integer into v_count
    from public.eut_contact_entitlements e
    where e.client_id=v_client and e.access_date=v_clock::date;
  select count(*)::integer into v_reserved
    from public.eut_contact_purchase_intents i
    where i.client_id=v_client and i.access_date=v_clock::date
      and i.state in ('prepared','provider_created') AND i.expires_at>now();

  return jsonb_build_object(
    'status',case when v_count+v_reserved>=v_daily_limit then 'limite_diario_atingido'
       when not v_contact_ready then 'contato_indisponivel'
       when not (v_terms->>'commercial_enabled')::boolean then 'pagamento_desativado'
       else 'aguardando_integracao_pagamento' end,
    'price_cents',(v_terms->>'quoted_price_cents')::integer,
    'price_version',(v_terms->>'price_version')::bigint,
    'commercial_enabled',(v_terms->>'commercial_enabled')::boolean,
    'currency','BRL',
    'timezone','America/Sao_Paulo',
    'commercial_hours',(v_terms->>'regular_from')||'-'||(v_terms->>'regular_until'),
    'contacts_per_purchase',1,
    'daily_max_contacts',v_daily_limit,
    'contacts_accessed_today',v_count,
    'contacts_reserved_today',v_reserved,
    'contacts_remaining_today',greatest(0,v_daily_limit-v_count-v_reserved),
    'contact_ready',v_contact_ready,
    'payment_available',false,
    'contact_released',false
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.eut_prepare_contact_purchase(_technician_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_client uuid := auth.uid();
  v_now timestamptz := now();
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_price integer;
  v_terms jsonb;
  v_pricing_version bigint;
  v_daily_limit integer;
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

  -- Atomically reserve up to the owner's current daily limit per client/day.
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

  select i.id,i.quoted_price_cents,i.pricing_version,i.expires_at into v_existing
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
      'price_version',v_existing.pricing_version,
      'currency','BRL',
      'expires_at',v_existing.expires_at,
      'payment_available',false,
      'contact_released',false
    );
  end if;

  -- A reservation already issued retains its original price until expiry.
  -- Only new reservations use the current owner-managed snapshot.
  v_terms := eut_migration.mp_quote_snapshot_at(v_now);
  if not (v_terms->>'commercial_enabled')::boolean then
    return jsonb_build_object('state','pagamento_desativado',
      'payment_available',false,'contact_released',false);
  end if;
  v_daily_limit := (v_terms->>'daily_contact_limit')::integer;

  select count(*)::integer into v_entitlements
  from public.eut_contact_entitlements e
  where e.client_id=v_client and e.access_date=v_day;

  select count(*)::integer into v_active_orders
  from public.eut_contact_purchase_intents i
  where i.client_id=v_client and i.access_date=v_day
    and i.state in ('prepared','provider_created')
    and i.expires_at>v_now;
  if v_entitlements+v_active_orders>=v_daily_limit then
    return jsonb_build_object('state','limite_diario_atingido','payment_available',false);
  end if;
  -- Failed or abandoned attempts can be retried, but avoid unbounded writes.
  if (
    select count(*) from public.eut_contact_purchase_intents i
    where i.client_id=v_client and i.access_date=v_day
  ) >= 10 then
    return jsonb_build_object('state','muitas_tentativas','payment_available',false);
  end if;

  v_price := (v_terms->>'quoted_price_cents')::integer;
  v_pricing_version := (v_terms->>'price_version')::bigint;
  v_expiry:=v_now+interval '15 minutes';
  insert into public.eut_contact_purchase_intents
    (client_id,technician_id,access_date,quoted_price_cents,pricing_version,expires_at)
  values (v_client,_technician_id,v_day,v_price,v_pricing_version,v_expiry)
  returning id into v_id;

  return jsonb_build_object(
    'state','preparado_sem_gateway',
    'order_id',v_id,
    'quoted_price_cents',v_price,
    'price_version',v_pricing_version,
    'currency','BRL',
    'expires_at',v_expiry,
    'payment_available',false,
    'contact_released',false
  );
end;
$function$
;

REVOKE ALL ON FUNCTION public.eut_contact_access_quote(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.eut_contact_access_quote(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.eut_prepare_contact_purchase(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.eut_prepare_contact_purchase(uuid) TO authenticated;

COMMIT;

-- Gate posterior: registrar backup lógico/reversão, homologia completa contra
-- versão oficial, autorizar SQL separadamente. Nenhum pagamento é acionado aqui.

