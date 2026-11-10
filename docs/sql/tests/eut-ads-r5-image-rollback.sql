-- EUT R5 | teste de banco em transação reversível; nenhum objeto persiste.
-- Este teste simula METADADOS de objetos e NÃO substitui teste real de Storage.copy.
BEGIN;
DO $$
DECLARE
  v_admin uuid;
  v_sponsor uuid;
  v_slot uuid;
  v_campaign uuid;
  v_creative uuid;
  v_private text;
  v_public text;
  v_result jsonb;
  v_denied boolean;
  v_nonadmin uuid:=gen_random_uuid();
  v_note text:='Contrato aprovado; imagem e destino revisados para publicação R5.';
BEGIN
  IF NOT has_function_privilege('anon',
      'public.eut_ads_public_slot(text,text)','EXECUTE') OR
     has_function_privilege('anon',
      'public.eut_ads_admin_activate_image(uuid,uuid,uuid,text)','EXECUTE') OR
     has_schema_privilege('anon','eut_ads','USAGE') THEN
    RAISE EXCEPTION 'Privilégios públicos inseguros';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id='eut-ad-delivery' AND public=true AND file_size_limit=5242880
  ) THEN RAISE EXCEPTION 'Bucket público de entrega incorreto'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage'
      AND tablename='objects' AND policyname='eut_ad_delivery_admin_copy'
  ) THEN RAISE EXCEPTION 'Política de cópia aprovada ausente'; END IF;

  SELECT r.user_id INTO v_admin FROM public.user_roles r
    JOIN auth.users u ON u.id=r.user_id
    WHERE r.role='admin'::public.app_role
      AND u.email_confirmed_at IS NOT NULL
    LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Admin verificado ausente'; END IF;

  INSERT INTO eut_ads.sponsors(brand_name,status)
    VALUES('R5 TEMP Sponsor','contracted') RETURNING id INTO v_sponsor;
  INSERT INTO eut_ads.placements
    (slot_key,route_pattern,position_label,format,device_scope,state,width_px,height_px)
    VALUES('home.content_1','/','Imagem temporária R5','image','all','available',970,250)
    RETURNING id INTO v_slot;
  INSERT INTO eut_ads.campaigns
    (sponsor_id,title,status,starts_at,ends_at,price_cents)
    VALUES(v_sponsor,'R5 Temporária','draft',statement_timestamp()-interval '1 minute',
      statement_timestamp()+interval '1 hour',19900)
    RETURNING id INTO v_campaign;

  v_private:='ads/'||gen_random_uuid()::text||'.webp';
  INSERT INTO storage.objects(bucket_id,name,metadata)
    VALUES('eut-ad-assets',v_private,
      '{"mimetype":"image/webp","size":12000}'::jsonb);
  INSERT INTO eut_ads.creatives
    (campaign_id,title,creative_type,media_storage_key,headline,
      image_alt,destination_url)
    VALUES(v_campaign,'Banner temporário R5','image',v_private,
      'Conheça o parceiro','Banner promocional revisado, imagem de teste',
      'https://example.com/anunciante')
    RETURNING id INTO v_creative;
  INSERT INTO eut_ads.campaign_placements(campaign_id,placement_id,enabled)
    VALUES(v_campaign,v_slot,false);

  IF public.eut_ads_public_slot('home.content_1','/') IS NOT NULL THEN
    RAISE EXCEPTION 'Imagem rascunho visível';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_nonadmin::text,true);
  v_denied:=false;
  BEGIN
    PERFORM public.eut_ads_admin_activate_image(v_campaign,v_creative,v_slot,v_note);
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Não-admin pôde aprovar imagem'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  v_denied:=false;
  BEGIN
    PERFORM public.eut_ads_admin_activate_image(v_campaign,v_creative,v_slot,'curto');
  EXCEPTION WHEN raise_exception THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Aprovação sem justificativa aceita'; END IF;

  v_result:=public.eut_ads_admin_activate_image(v_campaign,v_creative,v_slot,v_note);
  IF v_result->>'approved'<>'true' THEN
    RAISE EXCEPTION 'Aprovação de imagem não registrada';
  END IF;
  v_public:=v_result->>'public_media_key';
  IF v_public IS NULL OR v_public NOT LIKE 'approved/'||v_creative::text||'/%' THEN
    RAISE EXCEPTION 'Caminho da cópia não vinculado ao criativo';
  END IF;
  IF public.eut_ads_public_slot('home.content_1','/') IS NOT NULL THEN
    RAISE EXCEPTION 'Imagem visível ANTES da cópia de Storage';
  END IF;
  IF NOT public.eut_ads_can_copy_approved_asset(v_public) OR
     public.eut_ads_can_copy_approved_asset('approved/other/unknown.webp') THEN
    RAISE EXCEPTION 'Permissão de cópia não depende da aprovação';
  END IF;

  -- SIMULA apenas o registro Storage; a cópia dos bytes deve ser testada
  -- posteriormente com sessão real do administrador, fora deste rollback.
  INSERT INTO storage.objects(bucket_id,name,metadata)
    VALUES('eut-ad-delivery',v_public,
      '{"mimetype":"image/webp","size":12000}'::jsonb);
  PERFORM set_config('request.jwt.claim.sub','',true);
  v_result:=public.eut_ads_public_slot('home.content_1','/');
  IF v_result IS NULL OR v_result->>'creative_type'<>'image' OR
    v_result->>'public_media_key'<>v_public OR
    v_result->>'image_alt' IS NULL OR
    v_result->>'label'<>'Publicidade' THEN
    RAISE EXCEPTION 'Projeção pública de imagem aprovada incorreta';
  END IF;
  IF (v_result ?| ARRAY[
      'media_storage_key','contact_email','contact_phone_e164',
      'price_cents','campaign_id','tax_id_digits','internal_notes'
    ]) OR (SELECT count(*) FROM jsonb_object_keys(v_result))<>9 THEN
    RAISE EXCEPTION 'Projeção pública revelou dados privados';
  END IF;
  IF public.eut_ads_public_slot('home.content_1','/admin') IS NOT NULL THEN
    RAISE EXCEPTION 'Imagem exibida em rota privada';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM public.eut_ads_admin_save('pause_campaign',jsonb_build_object('id',v_campaign));
  IF public.eut_ads_public_slot('home.content_1','/') IS NOT NULL THEN
    RAISE EXCEPTION 'Imagem não removida pela pausa';
  END IF;
  RAISE NOTICE 'PASS: R5 aprovação, invisibilidade pré-cópia, anonimização, pausa; rollback';
END;
$$;
ROLLBACK;
