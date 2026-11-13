-- Disposable PostgreSQL ONLY. The deployed RPC bodies below are read-only
-- sourced from pg_get_functiondef. No PSP, hosted Auth or user data is touched.
CREATE TABLE public.eut_contact_entitlements (
 client_id uuid REFERENCES auth.users(id), technician_id uuid REFERENCES public.technicians(id),
 paid_at timestamptz, payment_reference text
);
CREATE OR REPLACE FUNCTION eut_migration.confirmed_current_email()
 RETURNS text LANGUAGE sql STABLE SET search_path='pg_catalog' AS $$
 SELECT 'client-qa@example.invalid'
 WHERE EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
   AND u.email_confirmed_at IS NOT NULL);
$$;

CREATE OR REPLACE FUNCTION public.eut_public_eligible_technician_ids(_ids uuid[])
 RETURNS TABLE(technician_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT t.id AS technician_id
 FROM public.technicians t
 WHERE _ids IS NOT NULL AND pg_catalog.cardinality(_ids) BETWEEN 1 AND 500
   AND t.id=ANY(_ids)
   AND t.status='aprovado'::public.approval_status
   AND eut_visibility.eut_public_technician_eligible(t.id)
 GROUP BY t.id ORDER BY t.id;
$function$;

CREATE OR REPLACE FUNCTION public.eut_reveal_paid_technician_contact(_technician_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_client uuid := auth.uid();
  v_phone text;
begin
  if v_client is null or eut_migration.confirmed_current_email() is null or
    not exists(select 1 from public.user_roles r where r.user_id=v_client and r.role='cliente'::public.app_role)
  then raise exception 'confirmed client login required'; end if;
  if _technician_id is null then return jsonb_build_object('status','indisponivel'); end if;

  if not exists (
    select 1 from public.eut_contact_entitlements e
    where e.client_id=v_client and e.technician_id=_technician_id
      and e.paid_at is not null and e.payment_reference is not null
  ) then
    return jsonb_build_object('status','pagamento_nao_confirmado');
  end if;

  select c.phone_e164 into v_phone
  from public.technicians t
  join public.eut_technician_private_contacts c on c.user_id=t.user_id
  where t.id=_technician_id and t.status='aprovado'::public.approval_status
    and c.allow_paid_contact and c.phone_e164 is not null;

  if v_phone is null then return jsonb_build_object('status','contato_indisponivel'); end if;
  return jsonb_build_object('status','liberado','phone',v_phone);
end;
$function$;

\echo 'Legacy contracts: Auth-less eligibility stays false; Auth legitimate stays true'
INSERT INTO auth.users(id,email_confirmed_at)
 VALUES ('00000000-0000-4000-8000-000000000007',now());
INSERT INTO public.profiles(id) VALUES ('00000000-0000-4000-8000-000000000007');
INSERT INTO public.user_roles(user_id,role) VALUES
 ('00000000-0000-4000-8000-000000000007','tecnico');
INSERT INTO public.technicians(id,user_id,display_name,city,state_uf,
 specialties,service_slugs,coverage_city_ids,status) VALUES
 ('10000000-0000-4000-8000-000000000007',
 '00000000-0000-4000-8000-000000000007','Laboratório Azul',
 'Curitiba','PR',ARRAY['computadores'],ARRAY['manutencao-pc'],ARRAY[4106902],'aprovado');
INSERT INTO public.eut_technician_private_contacts
 (user_id,phone_e164,allow_paid_contact) VALUES
 ('00000000-0000-4000-8000-000000000007','+5541999990007',true);
DO $qa$
DECLARE v_import uuid;
BEGIN
 SELECT technician_id INTO v_import FROM eut_moderation.catalog_provenance
 WHERE source_key='manual:lead-001';
 IF v_import IS NULL OR eut_visibility.eut_public_technician_eligible(v_import) THEN
  RAISE EXCEPTION 'Auth-less import qualifies under legacy eligibility'; END IF;
 IF EXISTS (SELECT 1 FROM public.technicians t JOIN
  public.eut_technician_private_contacts c ON c.user_id=t.user_id
  WHERE t.id=v_import) THEN
  RAISE EXCEPTION 'Auth-less import joins an Auth private phone'; END IF;
 IF EXISTS (SELECT 1 FROM public.eut_public_eligible_technician_ids(ARRAY[v_import])) THEN
  RAISE EXCEPTION 'Public eligible RPC included Auth-less import'; END IF;
 IF NOT eut_visibility.eut_public_technician_eligible(
  '10000000-0000-4000-8000-000000000007') OR
  NOT EXISTS (SELECT 1 FROM public.eut_public_eligible_technician_ids(
  ARRAY['10000000-0000-4000-8000-000000000007'::uuid])) THEN
  RAISE EXCEPTION 'Legitimate Auth profile no longer eligible'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.technicians t JOIN
  eut_moderation.catalog_provenance p ON p.technician_id=t.id
  WHERE p.source_key='wp:old-42' AND t.user_id IS NULL) THEN
  RAISE EXCEPTION 'WP unclaimed canonical record changed Auth identity'; END IF;
END $qa$;
\echo 'Legacy contacts: unpaid client must not receive any number'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
DO $qa$
DECLARE v_id uuid; reply jsonb;
BEGIN
 SELECT technician_id INTO v_id FROM eut_moderation.catalog_provenance
 WHERE source_key='manual:lead-001';
 reply:=public.eut_reveal_paid_technician_contact(v_id);
 IF reply->>'status'<>'pagamento_nao_confirmado' OR reply ? 'phone' THEN
   RAISE EXCEPTION 'Unpaid contact leaked'; END IF;
END $qa$;
\echo 'Legacy contacts: synthetic entitlement cannot unlock new private phone'
INSERT INTO public.eut_contact_entitlements(client_id,technician_id,paid_at,payment_reference)
SELECT '00000000-0000-4000-8000-000000000002',technician_id,now(),'synthetic-only'
FROM eut_moderation.catalog_provenance WHERE source_key='manual:lead-001';
DO $qa$
DECLARE v_id uuid; reply jsonb;
BEGIN
 SELECT technician_id INTO v_id FROM eut_moderation.catalog_provenance
 WHERE source_key='manual:lead-001';
 reply:=public.eut_reveal_paid_technician_contact(v_id);
 IF reply->>'status'<>'contato_indisponivel' OR reply ? 'phone' THEN
  RAISE EXCEPTION 'Auth-less paid contact exposed or reported released'; END IF;
END $qa$;
\echo 'Legacy contacts: legitimate Auth profile with synthetic entitlement still works'
INSERT INTO public.eut_contact_entitlements(client_id,technician_id,paid_at,payment_reference)
VALUES ('00000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000007',now(),'synthetic-only');
DO $qa$
DECLARE reply jsonb;
BEGIN
 reply:=public.eut_reveal_paid_technician_contact(
  '10000000-0000-4000-8000-000000000007');
 IF reply->>'status'<>'liberado' OR reply->>'phone'<>'+5541999990007' THEN
   RAISE EXCEPTION 'Legitimate Auth paid contact regression'; END IF;
END $qa$;
RESET ROLE;
\echo 'QA passed: legacy contact, public eligibility and WordPress identity isolation'
