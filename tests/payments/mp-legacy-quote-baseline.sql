-- Exact function definition read-only from official pg_get_functiondef on 2026-11-20.
-- Local synthetic fixture ONLY; never execute it on production.
CREATE OR REPLACE FUNCTION public.eut_contact_access_quote(_technician_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_client uuid := auth.uid();
  v_clock timestamp := now() at time zone 'America/Sao_Paulo';
  v_standard boolean;
  v_count integer;
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
  v_standard := v_clock::time>=time '09:00' and v_clock::time<time '18:00';
  select count(*)::integer into v_count
    from public.eut_contact_entitlements e
    where e.client_id=v_client and e.access_date=v_clock::date;

  return jsonb_build_object(
    'status',case when v_count>=2 then 'limite_diario_atingido'
       when not v_contact_ready then 'contato_indisponivel'
       else 'aguardando_integracao_pagamento' end,
    'price_cents',case when v_standard then 999 else 2999 end,
    'currency','BRL',
    'timezone','America/Sao_Paulo',
    'commercial_hours','09:00-18:00',
    'contacts_per_purchase',1,
    'daily_max_contacts',2,
    'contacts_accessed_today',v_count,
    'contacts_remaining_today',greatest(0,2-v_count),
    'contact_ready',v_contact_ready,
    'payment_available',false,
    'contact_released',false
  );
end;
$function$
;

