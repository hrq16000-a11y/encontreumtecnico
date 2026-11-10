-- EUT R4: exposição PUBLICA estritamente limitada a cards patrocinados aprovados.
-- Não publica imagens privadas, contatos, métricas, scripts ou dados de cobrança.
-- Esta etapa não insere anunciantes ou campanhas.
CREATE OR REPLACE FUNCTION public.eut_ads_public_slot(_slot_key text, _route_path text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE v_result jsonb;
BEGIN
  -- Apenas espaços implementados em páginas públicas selecionadas.
  IF (_slot_key,_route_path) NOT IN (
    ('home.content_1','/'),
    ('search.top','/tecnicos'),
    ('services.content_1','/servicos')
  ) THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'label','Publicidade',
    'brand_name',s.brand_name,
    'headline',COALESCE(NULLIF(btrim(cr.headline),''),s.brand_name),
    'description',COALESCE(cr.description,''),
    'destination_url',cr.destination_url,
    'creative_type','sponsored_card',
    'slot_key',p.slot_key
  ) INTO v_result
  FROM eut_ads.placements p
  JOIN eut_ads.campaign_placements cp ON cp.placement_id=p.id
  JOIN eut_ads.campaigns c ON c.id=cp.campaign_id
  JOIN eut_ads.sponsors s ON s.id=c.sponsor_id
  JOIN eut_ads.creatives cr ON cr.campaign_id=c.id
  WHERE p.slot_key=_slot_key AND p.route_pattern=_route_path
    AND p.format='sponsored_card'
    AND p.state='available'
    AND p.device_scope='all'
    AND cp.enabled=true
    AND cardinality(cp.uf_targets)=0
    AND cardinality(cp.city_targets)=0
    AND cardinality(cp.category_targets)=0
    AND cardinality(cp.service_targets)=0
    AND c.status='active'
    AND c.approved_by IS NOT NULL AND c.approved_at IS NOT NULL
    AND c.starts_at <= statement_timestamp()
    AND c.ends_at > statement_timestamp()
    AND s.status='contracted'
    AND cr.review_state='approved'
    AND cr.approved_by IS NOT NULL AND cr.approved_at IS NOT NULL
    AND cr.creative_type='sponsored_card'
    AND cr.destination_url ~* '^https://([a-z0-9-]+[.])+[a-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
  ORDER BY cp.priority ASC, c.approved_at ASC, cr.id ASC
  LIMIT 1;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.eut_ads_public_slot(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_ads_public_slot(text,text) TO anon, authenticated;

-- Aprovação explícita pelo proprietário/admin (não por papel comercial limitado).
-- Nesta R4 ativa apenas cards de texto, em espaços específicos e contratados.
CREATE OR REPLACE FUNCTION public.eut_ads_admin_activate_card(
  _campaign_id uuid, _creative_id uuid, _placement_id uuid, _approval_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_admin uuid;
  v_sponsor uuid;
  v_status text;
  v_start timestamptz;
  v_end timestamptz;
  v_price bigint;
  v_slot text;
  v_route text;
  v_note text := btrim(COALESCE(_approval_note,''));
BEGIN
  v_admin:=eut_ads.require_admin();
  IF length(v_note)<16 OR length(v_note)>500 THEN
    RAISE EXCEPTION 'Informe referência de contrato e autorização (16 a 500 caracteres)';
  END IF;
  IF _campaign_id IS NULL OR _creative_id IS NULL OR _placement_id IS NULL THEN
    RAISE EXCEPTION 'Campanha, criativo e espaço são obrigatórios';
  END IF;
  SELECT sponsor_id,status,starts_at,ends_at,price_cents
    INTO v_sponsor,v_status,v_start,v_end,v_price
  FROM eut_ads.campaigns WHERE id=_campaign_id FOR UPDATE;
  IF NOT FOUND OR v_status<>'draft' THEN
    RAISE EXCEPTION 'Apenas campanhas em rascunho podem ser aprovadas';
  END IF;
  IF v_start IS NULL OR v_end IS NULL
     OR v_start>statement_timestamp() OR v_end<=statement_timestamp()
     OR v_price IS NULL OR v_price<=0 THEN
    RAISE EXCEPTION 'Período ativo e valor comercial positivo são obrigatórios';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM eut_ads.sponsors WHERE id=v_sponsor AND status='contracted'
  ) THEN RAISE EXCEPTION 'Patrocinador precisa estar contratado'; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM eut_ads.creatives
    WHERE id=_creative_id AND campaign_id=_campaign_id
      AND review_state='draft' AND creative_type='sponsored_card'
      AND length(btrim(coalesce(headline,'')))>=3
      AND destination_url ~* '^https://([a-z0-9-]+[.])+[a-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
  ) THEN RAISE EXCEPTION 'Criativo textual revisável e HTTPS são obrigatórios'; END IF;

  SELECT slot_key,route_pattern INTO v_slot,v_route
  FROM eut_ads.placements
  WHERE id=_placement_id AND state='available'
    AND format='sponsored_card' AND device_scope='all';
  IF NOT FOUND OR (v_slot,v_route) NOT IN (
    ('home.content_1','/'),('search.top','/tecnicos'),
    ('services.content_1','/servicos')
  ) THEN RAISE EXCEPTION 'Espaço público não autorizado para R4'; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM eut_ads.campaign_placements
    WHERE campaign_id=_campaign_id AND placement_id=_placement_id
      AND enabled=false
      AND cardinality(uf_targets)=0 AND cardinality(city_targets)=0
      AND cardinality(category_targets)=0 AND cardinality(service_targets)=0
  ) THEN RAISE EXCEPTION 'Vínculo não encontrado ou segmentação pendente de revisão'; END IF;

  UPDATE eut_ads.creatives
    SET review_state='approved',approved_by=v_admin,
        approved_at=statement_timestamp(),updated_at=statement_timestamp()
    WHERE id=_creative_id AND review_state='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Falha na aprovação do criativo'; END IF;

  UPDATE eut_ads.campaigns
    SET status='active',approved_by=v_admin,approved_at=statement_timestamp(),
        internal_notes=left(concat_ws(E'\n',
          nullif(internal_notes,''),'R4 aprovação: '||v_note),3000),
        updated_at=statement_timestamp()
    WHERE id=_campaign_id AND status='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Falha na ativação da campanha'; END IF;

  UPDATE eut_ads.campaign_placements
    SET enabled=true,updated_at=statement_timestamp()
    WHERE campaign_id=_campaign_id AND placement_id=_placement_id
      AND enabled=false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Falha na ativação do vínculo'; END IF;

  RETURN jsonb_build_object(
    'activated',true,'campaign_id',_campaign_id,
    'slot_key',v_slot,'reviewed',true
  );
END;
$$;
REVOKE ALL ON FUNCTION public.eut_ads_admin_activate_card(uuid,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_ads_admin_activate_card(uuid,uuid,uuid,text)
  TO authenticated;

COMMENT ON FUNCTION public.eut_ads_public_slot(text,text)
  IS 'Public projection: only approved contracted sponsored cards on three explicit public slots; never PII or image storage keys.';
COMMENT ON FUNCTION public.eut_ads_admin_activate_card(uuid,uuid,uuid,text)
  IS 'Admin-verified, audited manual approval of contracted text cards; cannot publish private media.';
