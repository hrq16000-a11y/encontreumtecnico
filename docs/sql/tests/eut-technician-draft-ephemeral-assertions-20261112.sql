-- Run ONLY on the fresh disposable CI PostgreSQL database after fixture + proposal.
-- Stop on first failure; no users, phones, credentials or production identities here.
\echo 'Draft QA: owner-only RLS, authenticated technician'
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000011';
INSERT INTO public.eut_technician_drafts
 (owner_id,draft,step,expires_at)
VALUES
 ('00000000-0000-4000-8000-000000000011',
  '{"display_name":"Técnico QA","state_uf":"PR","city":"Curitiba","base_city_ibge_id":4106902,"neighborhood":"Jardim Itália","specialties":["computadores"],"service_slugs":["manutencao-pc"]}'::jsonb,
  2,now()+interval '365 days');

DO $assert$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.eut_technician_drafts
   WHERE owner_id='00000000-0000-4000-8000-000000000011'
     AND revision=1 AND step=2
     AND draft->>'neighborhood'='Jardim Itália'
     AND expires_at-updated_at BETWEEN INTERVAL '29 days' AND INTERVAL '31 days') THEN
  RAISE EXCEPTION 'Owner draft missing or TTL spoof accepted'; END IF;
END $assert$;

-- Simulate returning to a different browser session with the same signed identity.
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000011';
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.eut_technician_drafts)<>1 THEN
  RAISE EXCEPTION 'Draft not recovered by same owner'; END IF;
END $assert$;

UPDATE public.eut_technician_drafts
 SET step=3, revision=1, draft=jsonb_set(draft,'{bio}','"Atendimento profissional"'::jsonb)
 WHERE owner_id='00000000-0000-4000-8000-000000000011';
DO $assert$
DECLARE stale boolean:=false;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.eut_technician_drafts
   WHERE revision=2 AND step=3 AND draft->>'bio'='Atendimento profissional')
 THEN RAISE EXCEPTION 'Revision increment failed'; END IF;
 BEGIN
   UPDATE public.eut_technician_drafts SET revision=1,step=2
     WHERE owner_id='00000000-0000-4000-8000-000000000011';
 EXCEPTION WHEN SQLSTATE '40001' THEN stale:=true; END;
 IF NOT stale THEN RAISE EXCEPTION 'Stale revision was not rejected'; END IF;
END $assert$;

-- Tokens, contact channels, payment data and arbitrary fields are not part
-- of this contract, even if a user attempts to send them.
DO $assert$
DECLARE invalid_field boolean:=false; invalid_type boolean:=false;
BEGIN
 BEGIN
   UPDATE public.eut_technician_drafts
     SET draft=draft||'{"access_token":"synthetic_not_a_real_token"}'::jsonb
     WHERE owner_id='00000000-0000-4000-8000-000000000011';
 EXCEPTION WHEN SQLSTATE '23514' THEN invalid_field:=true; END;
 IF NOT invalid_field THEN RAISE EXCEPTION 'Sensitive fields not rejected'; END IF;
 BEGIN
   UPDATE public.eut_technician_drafts SET draft='{"specialties":"not-array"}'::jsonb
     WHERE owner_id='00000000-0000-4000-8000-000000000011';
 EXCEPTION WHEN SQLSTATE '23514' THEN invalid_type:=true; END;
 IF NOT invalid_type THEN RAISE EXCEPTION 'Wrong array types accepted'; END IF;
END $assert$;

\echo 'Draft QA: cross-tenant and cross-role isolation'
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000012';
DO $assert$
DECLARE blocked boolean:=false; updated_count integer;
BEGIN
 IF (SELECT count(*) FROM public.eut_technician_drafts)<>0 THEN
   RAISE EXCEPTION 'Second technician can read first technician draft'; END IF;
 UPDATE public.eut_technician_drafts SET step=1 WHERE
   owner_id='00000000-0000-4000-8000-000000000011';
 GET DIAGNOSTICS updated_count = ROW_COUNT;
 IF updated_count<>0 THEN RAISE EXCEPTION 'Cross-account update permitted'; END IF;
 BEGIN
   INSERT INTO public.eut_technician_drafts(owner_id,draft,step)
   VALUES('00000000-0000-4000-8000-000000000011','{}'::jsonb,1);
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Impersonated INSERT was not denied'; END IF;
END $assert$;
INSERT INTO public.eut_technician_drafts(owner_id,draft,step)
 VALUES ('00000000-0000-4000-8000-000000000012',
         '{"city":"Cruzeiro do Sul","state_uf":"AC"}'::jsonb,1);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.eut_technician_drafts)<>1 THEN
   RAISE EXCEPTION 'Owner visibility mismatch'; END IF;
END $assert$;

-- Client has an authenticated JWT but is NOT a technician.
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000013';
DO $assert$
DECLARE blocked boolean:=false;
BEGIN
 IF (SELECT count(*) FROM public.eut_technician_drafts)<>0 THEN
  RAISE EXCEPTION 'Client role read other drafts'; END IF;
 BEGIN
   INSERT INTO public.eut_technician_drafts(owner_id,draft,step)
     VALUES('00000000-0000-4000-8000-000000000013','{}'::jsonb,1);
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Client created a technician draft'; END IF;
END $assert$;
RESET ROLE;
SET ROLE anon;
DO $assert$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
   PERFORM count(*) FROM public.eut_technician_drafts;
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Anonymous data access was not denied'; END IF;
END $assert$;
RESET ROLE;

\echo 'Draft QA: expiry prevents recovery but preserves existing unrelated rows'
-- Emulate elapsed time without waiting 30 days; superuser operation in test only.
ALTER TABLE public.eut_technician_drafts DISABLE TRIGGER eut_guard_technician_draft;
UPDATE public.eut_technician_drafts
 SET updated_at=now()-INTERVAL '31 days',
     expires_at=now()-INTERVAL '1 day'
 WHERE owner_id='00000000-0000-4000-8000-000000000011';
ALTER TABLE public.eut_technician_drafts ENABLE TRIGGER eut_guard_technician_draft;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000011';
DO $assert$
DECLARE refused boolean:=false;
BEGIN
 -- The owner can still inspect/delete stale rows, but recovery MUST filter TTL.
 IF (SELECT count(*) FROM public.eut_technician_drafts
     WHERE expires_at > now())<>0 THEN
   RAISE EXCEPTION 'Expired draft still eligible for recovery'; END IF;
 BEGIN
   UPDATE public.eut_technician_drafts SET step=1
     WHERE owner_id='00000000-0000-4000-8000-000000000011';
 EXCEPTION WHEN SQLSTATE '22023' THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'Expired draft was renewed on UPDATE'; END IF;
END $assert$;
DELETE FROM public.eut_technician_drafts
 WHERE owner_id='00000000-0000-4000-8000-000000000011';
RESET ROLE;
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.eut_technician_drafts)<>1 THEN
  RAISE EXCEPTION 'Expiry cleanup deleted another owner draft'; END IF;
END $assert$;

\echo 'Retention QA: privileged batch cleanup, no Data API access'
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000011';
DO $assert$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
   PERFORM eut_moderation.eut_purge_expired_technician_drafts(500);
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN
   RAISE EXCEPTION 'Authenticated users could invoke privileged cleanup';
 END IF;
END $assert$;
RESET ROLE;

-- The previous owner-deletion left only account 12's unexpired row.
-- Re-create account 11's synthetic draft; make both expire through privileged
-- fixture manipulation only. Do not simulate dates against a hosted database.
INSERT INTO public.eut_technician_drafts(owner_id,draft,step)
  VALUES('00000000-0000-4000-8000-000000000011',
    '{"city":"São José dos Pinhais","state_uf":"PR"}'::jsonb,1);
ALTER TABLE public.eut_technician_drafts DISABLE TRIGGER eut_guard_technician_draft;
UPDATE public.eut_technician_drafts SET
  updated_at=now()-INTERVAL '31 days',
  expires_at=now()-INTERVAL '1 day'
WHERE owner_id='00000000-0000-4000-8000-000000000011';
ALTER TABLE public.eut_technician_drafts ENABLE TRIGGER eut_guard_technician_draft;

DO $assert$
DECLARE c integer;
BEGIN
 IF (SELECT count(*) FROM public.eut_technician_drafts WHERE expires_at>now()) <> 1 THEN
   RAISE EXCEPTION 'Expected unexpired second technician draft'; END IF;
 c:=eut_moderation.eut_purge_expired_technician_drafts(1);
 IF c <> 1 THEN RAISE EXCEPTION 'Cleanup did not remove exactly one expired row'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.eut_technician_drafts
   WHERE owner_id='00000000-0000-4000-8000-000000000012'
     AND expires_at>now()) THEN
   RAISE EXCEPTION 'Cleanup removed valid draft belonging to another owner'; END IF;
 IF eut_moderation.eut_purge_expired_technician_drafts(1) <> 0 THEN
   RAISE EXCEPTION 'Cleanup removed nonexpired draft'; END IF;
END $assert$;

DO $assert$
DECLARE refused boolean:=false;
BEGIN
 BEGIN
   PERFORM eut_moderation.eut_purge_expired_technician_drafts(0);
 EXCEPTION WHEN SQLSTATE '22023' THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'Cleanup accepted unsafe batch size'; END IF;
END $assert$;
\echo 'PASS: durable drafts RLS, optimistic revision, expiry and private bounded cleanup'

