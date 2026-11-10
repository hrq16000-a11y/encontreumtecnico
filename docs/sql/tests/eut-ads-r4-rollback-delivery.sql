-- R4 homologação SQL real, somente dentro de transação; nenhum dado de teste persiste.
BEGIN;
DO $$
DECLARE
  v_admin uuid;
  v_nonadmin uuid:=gen_random_uuid();
  v_sponsor uuid;
  v_slot uuid;
  v_campaign uuid;
  v_creative uuid;
  v_record jsonb;
  v_denied boolean;
  v_note text:='Contrato confirmado internamente para a rodada R4; arte textual aprovada.';
BEGIN
  IF has_function_privilege('anon','public.eut_ads_admin_activate_card(uuid,uuid,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Ativação acessível para anônimos';
  END IF;
  IF NOT has_function_privilege('anon','public.eut_ads_public_slot(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Projeção pública não está autorizada';
  END IF;
  IF has_schema_privilege('anon','eut_ads','USAGE') OR
     has_table_privilege('anon','eut_ads.sponsors','SELECT') THEN
    RAISE EXCEPTION 'Dados comerciais privados expostos';
  END IF;

  SELECT r.user_id INTO v_admin FROM public.user_roles r
  JOIN auth.users u ON u.id=r.user_id
  WHERE r.role='admin'::public.app_role AND u.email_confirmed_at IS NOT NULL
  LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Nenhum administrador verificado para teste positivo'; END IF;

  -- Cria um exemplo temporário para confirmar filtro de revisão e período.
  INSERT INTO eut_ads.sponsors (brand_name,status,contact_email,contact_phone_e164,internal_notes)
    VALUES ('R4 TEST ADVERTISER','contracted','private-r4@example.com',
            '+5541999998888','Referência comercial de teste em rollback')
    RETURNING id INTO v_sponsor;
  INSERT INTO eut_ads.placements
    (slot_key,route_pattern,position_label,format,device_scope,state,width_px,height_px)
    VALUES ('home.content_1','/','R4 área principal','sponsored_card','all','available',970,160)
    RETURNING id INTO v_slot;
  INSERT INTO eut_ads.campaigns
    (sponsor_id,title,status,starts_at,ends_at,price_cents)
    VALUES (v_sponsor,'R4 TEST CAMPAIGN','draft',
            statement_timestamp()-interval '1 minute',
            statement_timestamp()+interval '1 hour',10000)
    RETURNING id INTO v_campaign;
  INSERT INTO eut_ads.creatives
    (campaign_id,title,creative_type,headline,description,destination_url)
    VALUES (v_campaign,'R4 TEST CREATIVE','sponsored_card',
            'Visite o parceiro temporário','Texto seguro de teste',
            'https://example.com/patrocinio')
    RETURNING id INTO v_creative;
  INSERT INTO eut_ads.campaign_placements (campaign_id,placement_id,enabled)
    VALUES(v_campaign,v_slot,false);

  IF public.eut_ads_public_slot('home.content_1','/') IS NOT NULL THEN
    RAISE EXCEPTION 'Campanha em rascunho vazou na projeção pública';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_nonadmin::text,true);
  v_denied:=false;
  BEGIN
    PERFORM public.eut_ads_admin_activate_card(
      v_campaign,v_creative,v_slot,v_note
    );
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Pessoa sem papel admin conseguiu publicar'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  v_denied:=false;
  BEGIN
    PERFORM public.eut_ads_admin_activate_card(
      v_campaign,v_creative,v_slot,'curta'
    );
  EXCEPTION WHEN raise_exception THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Aprovação sem justificativa foi permitida'; END IF;

  v_record:=public.eut_ads_admin_activate_card(
    v_campaign,v_creative,v_slot,v_note
  );
  IF COALESCE((v_record->>'activated')::boolean,false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Falha na aprovação legítima';
  END IF;

  -- A projeção funciona para anon e contém SOMENTE os sete campos públicos.
  PERFORM set_config('request.jwt.claim.sub','',true);
  v_record:=public.eut_ads_public_slot('home.content_1','/');
  IF v_record IS NULL OR v_record->>'label'<>'Publicidade' OR
     v_record->>'brand_name'<>'R4 TEST ADVERTISER' THEN
    RAISE EXCEPTION 'Anúncio aprovado não foi entregue';
  END IF;
  IF (v_record ?| ARRAY[
       'contact_email','contact_phone_e164','tax_id_digits','price_cents',
       'media_storage_key','approved_by','sponsor_id','campaign_id',
       'internal_notes','user_id'
     ]) THEN RAISE EXCEPTION 'Projeção revelou dados internos ou pessoais'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(v_record))<>7 THEN
    RAISE EXCEPTION 'Campos inesperados expostos no anúncio';
  END IF;

  IF public.eut_ads_public_slot('home.content_1','/admin') IS NOT NULL OR
     public.eut_ads_public_slot('home.content_1','/tecnicos') IS NOT NULL OR
     public.eut_ads_public_slot('unknown.slot','/') IS NOT NULL THEN
    RAISE EXCEPTION 'Anúncio escapou da rota e do slot autorizado';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM public.eut_ads_admin_save('pause_campaign',jsonb_build_object('id',v_campaign));
  IF public.eut_ads_public_slot('home.content_1','/') IS NOT NULL THEN
    RAISE EXCEPTION 'Pausa não interrompeu exibição';
  END IF;

  RAISE NOTICE 'R4 PASS: publicação aprovada, anonimização, rotas, revisão e pausa imediata; rollback total';
END;
$$;
ROLLBACK;
