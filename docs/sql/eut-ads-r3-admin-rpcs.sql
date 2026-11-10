-- EUT R3: operações administrativas de publicidade (sem delivery público).
-- Complementa eut_ads_r2_private_foundation_20261110.
-- Privilegiadas e role-checked: o navegador só usa RPCs autenticadas,
-- sem chave service_role, sem grants diretos nas tabelas de eut_ads.

CREATE OR REPLACE FUNCTION eut_ads.require_admin()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.user_roles r ON r.user_id=u.id
    WHERE u.id=v_uid AND u.email_confirmed_at IS NOT NULL
      AND r.role='admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'EUT advertising administration requires verified administrator'
      USING ERRCODE='42501';
  END IF;
  RETURN v_uid;
END;
$$;
REVOKE ALL ON FUNCTION eut_ads.require_admin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.eut_ads_admin_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
BEGIN
  PERFORM eut_ads.require_admin();
  RETURN jsonb_build_object(
    'sponsors', COALESCE((
      SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT id, brand_name, legal_name, contact_email, contact_phone_e164,
               website_url, status, internal_notes, created_at
        FROM eut_ads.sponsors ORDER BY created_at DESC, id LIMIT 100
      ) q
    ), '[]'::jsonb),
    'placements', COALESCE((
      SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT id, slot_key, route_pattern, position_label, format, device_scope,
               width_px, height_px, state, created_at
        FROM eut_ads.placements ORDER BY created_at DESC, id LIMIT 100
      ) q
    ), '[]'::jsonb),
    'campaigns', COALESCE((
      SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT id, sponsor_id, title, status, starts_at, ends_at, pricing_model,
               price_cents, budget_limit_cents, approved_at, created_at
        FROM eut_ads.campaigns ORDER BY created_at DESC, id LIMIT 100
      ) q
    ), '[]'::jsonb),
    'creatives', COALESCE((
      SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT id, campaign_id, title, creative_type, media_storage_key,
               headline, description, image_alt, destination_url,
               review_state, created_at
        FROM eut_ads.creatives ORDER BY created_at DESC, id LIMIT 100
      ) q
    ), '[]'::jsonb),
    'assignments', COALESCE((
      SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT id, campaign_id, placement_id, enabled, priority
        FROM eut_ads.campaign_placements ORDER BY created_at DESC, id LIMIT 100
      ) q
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'sponsors', (SELECT count(*) FROM eut_ads.sponsors),
      'placements', (SELECT count(*) FROM eut_ads.placements),
      'campaigns', (SELECT count(*) FROM eut_ads.campaigns),
      'creatives', (SELECT count(*) FROM eut_ads.creatives),
      'assignments', (SELECT count(*) FROM eut_ads.campaign_placements)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.eut_ads_admin_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_ads_admin_snapshot() TO authenticated;

-- One entry point, explicit per-kind SQL branches, strict JSON key whitelist.
-- No operator can send arbitrary SQL, column names, approval or active states.
CREATE OR REPLACE FUNCTION public.eut_ads_admin_save(_kind text, _data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_user uuid;
  v_id uuid;
  v_key text;
  v_allowed text[];
  v_state text;
  v_brand text;
  v_sponsor_id uuid;
  v_campaign_id uuid;
  v_placement_id uuid;
  v_title text;
  v_slot_key text;
  v_type text;
  v_price bigint;
  v_start timestamptz;
  v_end timestamptz;
  v_url text;
  v_media text;
BEGIN
  v_user := eut_ads.require_admin();
  IF _data IS NULL OR jsonb_typeof(_data)<>'object' THEN
    RAISE EXCEPTION 'Invalid advertising payload';
  END IF;
  IF length(_data::text)>12000 THEN RAISE EXCEPTION 'Advertising payload too large'; END IF;
  IF _kind='sponsor' THEN
    v_allowed:=ARRAY['id','brand_name','legal_name','contact_email',
                     'contact_phone_e164','website_url','status','internal_notes'];
  ELSIF _kind='placement' THEN
    v_allowed:=ARRAY['id','slot_key','route_pattern','position_label',
                     'format','device_scope','width_px','height_px','state'];
  ELSIF _kind='campaign' THEN
    v_allowed:=ARRAY['id','sponsor_id','title','starts_at','ends_at',
                     'pricing_model','price_cents','budget_limit_cents','status'];
  ELSIF _kind='creative' THEN
    v_allowed:=ARRAY['id','campaign_id','title','creative_type','headline',
                     'description','destination_url','image_alt','media_storage_key'];
  ELSIF _kind='assignment' THEN
    v_allowed:=ARRAY['campaign_id','placement_id','priority'];
  ELSIF _kind='pause_campaign' THEN
    v_allowed:=ARRAY['id'];
  ELSE
    RAISE EXCEPTION 'Unsupported advertising operation';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(_data) LOOP
    IF NOT v_key=ANY(v_allowed) THEN
      RAISE EXCEPTION 'Field not allowed for advertising operation';
    END IF;
  END LOOP;
  IF _kind<>'assignment' THEN
    v_id:=nullif(_data->>'id','')::uuid;
  END IF;

  IF _kind='sponsor' THEN
    v_brand:=btrim(coalesce(_data->>'brand_name',''));
    v_state:=coalesce(_data->>'status','prospect');
    IF length(v_brand)<2 OR length(v_brand)>120 THEN RAISE EXCEPTION 'Sponsor name required'; END IF;
    IF v_state NOT IN ('prospect','negotiating','contracted','paused','archived') THEN
      RAISE EXCEPTION 'Invalid sponsor status';
    END IF;
    IF v_id IS NULL THEN
      INSERT INTO eut_ads.sponsors
        (brand_name,legal_name,contact_email,contact_phone_e164,website_url,status,internal_notes)
      VALUES
        (v_brand,nullif(btrim(_data->>'legal_name'),''),
         nullif(btrim(_data->>'contact_email'),''),
         nullif(btrim(_data->>'contact_phone_e164'),''),
         nullif(btrim(_data->>'website_url'),''),v_state,
         coalesce(_data->>'internal_notes',''))
      RETURNING id INTO v_id;
    ELSE
      UPDATE eut_ads.sponsors SET
        brand_name=v_brand,legal_name=nullif(btrim(_data->>'legal_name'),''),
        contact_email=nullif(btrim(_data->>'contact_email'),''),
        contact_phone_e164=nullif(btrim(_data->>'contact_phone_e164'),''),
        website_url=nullif(btrim(_data->>'website_url'),''),
        status=v_state,internal_notes=coalesce(_data->>'internal_notes',''),
        updated_at=now()
      WHERE id=v_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Sponsor not found'; END IF;
    END IF;

  ELSIF _kind='placement' THEN
    v_slot_key:=coalesce(_data->>'slot_key','');
    v_title:=btrim(coalesce(_data->>'position_label',''));
    v_type:=coalesce(_data->>'format','image');
    v_state:=coalesce(_data->>'state','draft');
    IF v_state NOT IN ('draft','available','paused','retired') THEN
      RAISE EXCEPTION 'Invalid placement state';
    END IF;
    IF v_id IS NULL THEN
      INSERT INTO eut_ads.placements
        (slot_key,route_pattern,position_label,format,device_scope,width_px,height_px,state)
      VALUES
        (v_slot_key,coalesce(_data->>'route_pattern',''),v_title,v_type,
         coalesce(_data->>'device_scope','all'),
         nullif(_data->>'width_px','')::integer,
         nullif(_data->>'height_px','')::integer,v_state)
      RETURNING id INTO v_id;
    ELSE
      UPDATE eut_ads.placements SET
        -- Stable slot_key; never rename a placement identifier after creation.
        route_pattern=coalesce(_data->>'route_pattern',''),
        position_label=v_title,format=v_type,
        device_scope=coalesce(_data->>'device_scope','all'),
        width_px=nullif(_data->>'width_px','')::integer,
        height_px=nullif(_data->>'height_px','')::integer,
        state=v_state,updated_at=now()
      WHERE id=v_id AND slot_key=v_slot_key;
      IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found or key changed'; END IF;
    END IF;

  ELSIF _kind='campaign' THEN
    v_sponsor_id:=nullif(_data->>'sponsor_id','')::uuid;
    v_title:=btrim(coalesce(_data->>'title',''));
    v_state:=coalesce(_data->>'status','draft');
    IF v_state NOT IN ('draft','paused','archived') THEN
      RAISE EXCEPTION 'Campaign approval/publishing is disabled in R3';
    END IF;
    v_start:=nullif(_data->>'starts_at','')::timestamptz;
    v_end:=nullif(_data->>'ends_at','')::timestamptz;
    v_price:=nullif(_data->>'price_cents','')::bigint;
    IF v_sponsor_id IS NULL OR length(v_title)<3 THEN
      RAISE EXCEPTION 'Sponsor and campaign title required';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM eut_ads.sponsors WHERE id=v_sponsor_id AND status<>'archived') THEN
      RAISE EXCEPTION 'Active sponsor required';
    END IF;
    IF v_id IS NULL THEN
      INSERT INTO eut_ads.campaigns
        (sponsor_id,title,status,starts_at,ends_at,pricing_model,price_cents,budget_limit_cents)
      VALUES
        (v_sponsor_id,v_title,v_state,v_start,v_end,
         coalesce(_data->>'pricing_model','fixed'),v_price,
         nullif(_data->>'budget_limit_cents','')::bigint)
      RETURNING id INTO v_id;
    ELSE
      UPDATE eut_ads.campaigns SET
        sponsor_id=v_sponsor_id,title=v_title,status=v_state,
        starts_at=v_start,ends_at=v_end,
        pricing_model=coalesce(_data->>'pricing_model','fixed'),
        price_cents=v_price,
        budget_limit_cents=nullif(_data->>'budget_limit_cents','')::bigint,
        updated_at=now()
      WHERE id=v_id AND status IN ('draft','paused');
      IF NOT FOUND THEN RAISE EXCEPTION 'Campaign immutable after approval'; END IF;
    END IF;

  ELSIF _kind='creative' THEN
    v_campaign_id:=nullif(_data->>'campaign_id','')::uuid;
    v_title:=btrim(coalesce(_data->>'title',''));
    v_type:=coalesce(_data->>'creative_type','sponsored_card');
    v_media:=nullif(btrim(_data->>'media_storage_key'),'');
    v_url:=btrim(coalesce(_data->>'destination_url',''));
    IF v_campaign_id IS NULL OR length(v_title)<3 THEN
      RAISE EXCEPTION 'Campaign and creative title required';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM eut_ads.campaigns WHERE id=v_campaign_id AND status='draft') THEN
      RAISE EXCEPTION 'Draft campaign required to edit creative';
    END IF;
    IF v_type='image' AND v_media IS NULL THEN
      RAISE EXCEPTION 'Image asset reference required';
    END IF;
    IF v_type NOT IN ('sponsored_card','image') THEN
      RAISE EXCEPTION 'Unsupported R3 creative type';
    END IF;
    IF v_id IS NULL THEN
      INSERT INTO eut_ads.creatives
        (campaign_id,title,creative_type,media_storage_key,headline,description,image_alt,destination_url)
      VALUES
        (v_campaign_id,v_title,v_type,v_media,
         nullif(btrim(_data->>'headline'),''),
         nullif(btrim(_data->>'description'),''),
         nullif(btrim(_data->>'image_alt'),''),v_url)
      RETURNING id INTO v_id;
    ELSE
      UPDATE eut_ads.creatives SET
        campaign_id=v_campaign_id,title=v_title,creative_type=v_type,
        media_storage_key=v_media,headline=nullif(btrim(_data->>'headline'),''),
        description=nullif(btrim(_data->>'description'),''),
        image_alt=nullif(btrim(_data->>'image_alt'),''),
        destination_url=v_url,updated_at=now()
      WHERE id=v_id AND review_state='draft';
      IF NOT FOUND THEN RAISE EXCEPTION 'Creative immutable after review'; END IF;
    END IF;

  ELSIF _kind='assignment' THEN
    v_campaign_id:=nullif(_data->>'campaign_id','')::uuid;
    v_placement_id:=nullif(_data->>'placement_id','')::uuid;
    IF v_campaign_id IS NULL OR v_placement_id IS NULL THEN
      RAISE EXCEPTION 'Campaign and placement required';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM eut_ads.campaigns WHERE id=v_campaign_id AND status='draft')
      OR NOT EXISTS(SELECT 1 FROM eut_ads.placements WHERE id=v_placement_id AND state<>'retired')
    THEN RAISE EXCEPTION 'Draft campaign and valid placement required'; END IF;
    INSERT INTO eut_ads.campaign_placements
      (campaign_id,placement_id,priority,enabled)
    VALUES (v_campaign_id,v_placement_id,coalesce(nullif(_data->>'priority','')::integer,100),false)
    ON CONFLICT(campaign_id,placement_id) DO UPDATE SET
      priority=excluded.priority,enabled=false,updated_at=now()
    RETURNING id INTO v_id;

  ELSIF _kind='pause_campaign' THEN
    IF v_id IS NULL THEN RAISE EXCEPTION 'Campaign id required'; END IF;
    UPDATE eut_ads.campaigns
      SET status='paused',updated_at=now()
    WHERE id=v_id AND status IN ('draft','in_review','approved','scheduled','active','paused');
    IF NOT FOUND THEN RAISE EXCEPTION 'Campaign cannot be paused'; END IF;
  END IF;

  RETURN jsonb_build_object('saved',true,'kind',_kind,'id',v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.eut_ads_admin_save(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_ads_admin_save(text,jsonb) TO authenticated;
COMMENT ON FUNCTION public.eut_ads_admin_save(text,jsonb)
  IS 'Restricted ads editor. No public render and no campaign approval or activation in R3.';
