-- EUT R3 private CRUD verification: all test mutations are ROLLED BACK.
-- Run as project-owner SQL editor, not from a browser client.
BEGIN;
DO $$
DECLARE
  v_owner uuid;
  v_random uuid := gen_random_uuid();
  v_snapshot jsonb;
  v_sponsor uuid;
  v_slot uuid;
  v_campaign uuid;
  v_creative uuid;
  v_assignment uuid;
  v_rejected boolean;
BEGIN
  IF has_function_privilege('anon','public.eut_ads_admin_snapshot()','EXECUTE') OR
     has_function_privilege('anon','public.eut_ads_admin_save(text,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'Ads RPC callable anonymously'; END IF;
  IF NOT has_function_privilege('authenticated','public.eut_ads_admin_snapshot()','EXECUTE') OR
     NOT has_function_privilege('authenticated','public.eut_ads_admin_save(text,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'Admin RPC grants absent'; END IF;
  IF has_schema_privilege('authenticated','eut_ads','USAGE') OR
     has_table_privilege('authenticated','eut_ads.sponsors','SELECT') THEN
    RAISE EXCEPTION 'Private ads schema leaked';
  END IF;

  -- No session, then authenticated user without admin role: both must fail.
  PERFORM set_config('request.jwt.claim.sub','',true);
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_ads_admin_snapshot();
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Anonymous snapshot permitted'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_random::text,true);
  v_rejected:=false;
  BEGIN
    PERFORM public.eut_ads_admin_save('sponsor','{"brand_name":"Unauthorized"}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Non-admin could write ads'; END IF;

  SELECT r.user_id INTO v_owner FROM public.user_roles r JOIN auth.users u ON u.id=r.user_id
   WHERE r.role='admin'::public.app_role AND u.email_confirmed_at IS NOT NULL LIMIT 1;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'No verified owner exists for positive R3 test'; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
  v_snapshot:=public.eut_ads_admin_snapshot();
  IF jsonb_typeof(v_snapshot->'sponsors')<>'array' OR
     jsonb_typeof(v_snapshot->'placements')<>'array' THEN
    RAISE EXCEPTION 'Admin snapshot malformed';
  END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.eut_ads_admin_save('sponsor','{"brand_name":"Test","approved_by":"spoof"}'::jsonb);
  EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Unexpected field accepted'; END IF;

  v_sponsor:=(public.eut_ads_admin_save('sponsor',jsonb_build_object(
    'brand_name','R3 TEMP SPONSOR','status','prospect'
  ))->>'id')::uuid;
  v_slot:=(public.eut_ads_admin_save('placement',jsonb_build_object(
    'slot_key','r3.temp_private','route_pattern','/tecnicos',
    'position_label','R3 TEST SLOT','format','image','state','draft'
  ))->>'id')::uuid;
  v_campaign:=(public.eut_ads_admin_save('campaign',jsonb_build_object(
    'sponsor_id',v_sponsor,'title','R3 TEMP CAMPAIGN','status','draft'
  ))->>'id')::uuid;
  v_creative:=(public.eut_ads_admin_save('creative',jsonb_build_object(
    'campaign_id',v_campaign,'title','R3 TEMP CARD','creative_type','sponsored_card',
    'headline','R3 test','destination_url','https://example.com'
  ))->>'id')::uuid;
  v_assignment:=(public.eut_ads_admin_save('assignment',jsonb_build_object(
    'campaign_id',v_campaign,'placement_id',v_slot,'priority',10
  ))->>'id')::uuid;
  IF v_sponsor IS NULL OR v_slot IS NULL OR v_campaign IS NULL
    OR v_creative IS NULL OR v_assignment IS NULL THEN
    RAISE EXCEPTION 'R3 CRUD failed';
  END IF;
  IF EXISTS(SELECT 1 FROM eut_ads.campaign_placements p
    WHERE p.id=v_assignment AND p.enabled) THEN
    RAISE EXCEPTION 'Assignment was improperly activated';
  END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.eut_ads_admin_save('campaign',jsonb_build_object(
      'sponsor_id',v_sponsor,'title','Should never activate',
      'status','active'
    ));
  EXCEPTION WHEN raise_exception THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'R3 campaign activation allowed'; END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.eut_ads_admin_save('placement',jsonb_build_object(
      'slot_key','r3.private','route_pattern','/admin',
      'position_label','Forbidden admin ad','format','image'
    ));
  EXCEPTION WHEN check_violation THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Private admin ad slot was accepted'; END IF;

  IF (SELECT count(*) FROM eut_ads.audit_events
      WHERE entity_id IN (v_sponsor,v_slot,v_campaign,v_creative,v_assignment)) < 5 THEN
    RAISE EXCEPTION 'Missing admin write audit events';
  END IF;

  PERFORM public.eut_ads_admin_save('pause_campaign',jsonb_build_object('id',v_campaign));
  IF NOT EXISTS(SELECT 1 FROM eut_ads.campaigns
    WHERE id=v_campaign AND status='paused') THEN
    RAISE EXCEPTION 'Campaign could not be paused';
  END IF;

  RAISE NOTICE 'PASS: admin CRUD, audit, negative RLS/RPC cases, safe drafts and pause; transaction will roll back';
END;
$$;
ROLLBACK;
