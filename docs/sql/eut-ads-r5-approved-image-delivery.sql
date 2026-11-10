-- EUT Ads R5 | Imagens publicadas apenas depois da aprovação administrativa.
-- Zero seed, nenhum arquivo privado servido ao público, nenhuma cobrança fictícia.
-- Upload original: eut-ad-assets (privado). Cópia: eut-ad-delivery (público).
-- Storage.copy com destinationBucket copia apenas após aprovação registrada.

ALTER TABLE eut_ads.creatives
ADD COLUMN public_media_key text
  CONSTRAINT eut_ads_public_media_key_format CHECK (
    public_media_key IS NULL OR
    public_media_key ~ '^approved/[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp|avif)$'
  );
CREATE UNIQUE INDEX eut_ads_public_media_key_unique
  ON eut_ads.creatives(public_media_key) WHERE public_media_key IS NOT NULL;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('eut-ad-delivery','eut-ad-delivery',true,5242880,
        ARRAY['image/png','image/jpeg','image/webp','image/avif']::text[])
ON CONFLICT(id) DO NOTHING;

-- Esta função é chamada somente pela política de Storage, do lado do servidor.
-- O nome deve corresponder a uma mídia aprovada da campanha realmente ativa.
CREATE OR REPLACE FUNCTION public.eut_ads_can_copy_approved_asset(_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
BEGIN
  PERFORM eut_ads.require_admin();
  IF _path IS NULL OR _path !~
      '^approved/[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp|avif)$'
  THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM eut_ads.creatives cr
    JOIN eut_ads.campaigns c ON c.id=cr.campaign_id
    JOIN eut_ads.sponsors s ON s.id=c.sponsor_id
    WHERE cr.public_media_key=_path AND cr.review_state='approved'
      AND cr.creative_type='image' AND cr.approved_by IS NOT NULL
      AND c.status='active' AND c.approved_by IS NOT NULL
      AND s.status='contracted'
      AND c.starts_at<=statement_timestamp() AND c.ends_at>statement_timestamp()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.eut_ads_can_copy_approved_asset(text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_ads_can_copy_approved_asset(text)
  TO authenticated;

-- Nenhuma escrita/remoção pública na biblioteca de entrega.
-- A cópia administrativa só ocorre se a referência já foi aprovada pelo backend.
CREATE POLICY eut_ad_delivery_admin_copy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id='eut-ad-delivery'
    AND name ~ '^approved/[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp|avif)$'
    AND (SELECT public.eut_ads_can_copy_approved_asset(name))
  );
CREATE POLICY eut_ad_delivery_admin_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id='eut-ad-delivery'
    AND (SELECT public.has_role((SELECT auth.uid()),'admin'::public.app_role))
  );

-- Snapshot privado permite recuperar uma cópia interrompida por falha de rede.
-- Não altera dados pessoais ou as regras de gestão R3.
CREATE OR REPLACE FUNCTION public.eut_ads_admin_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
BEGIN
  PERFORM eut_ads.require_admin();
  RETURN jsonb_build_object(
    'sponsors', COALESCE((
      SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT id,brand_name,legal_name,tax_id_digits,contact_email,
          contact_phone_e164,website_url,status,internal_notes,created_at
        FROM eut_ads.sponsors ORDER BY created_at DESC,id LIMIT 100
      ) q
    ),'[]'::jsonb),
    'placements', COALESCE((
      SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT id,slot_key,route_pattern,position_label,format,device_scope,
          width_px,height_px,state,created_at
        FROM eut_ads.placements ORDER BY created_at DESC,id LIMIT 100
      ) q
    ),'[]'::jsonb),
    'campaigns', COALESCE((
      SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT id,sponsor_id,title,status,starts_at,ends_at,pricing_model,
          price_cents,budget_limit_cents,approved_at,created_at
        FROM eut_ads.campaigns ORDER BY created_at DESC,id LIMIT 100
      ) q
    ),'[]'::jsonb),
    'creatives', COALESCE((
      SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT id,campaign_id,title,creative_type,media_storage_key,
          public_media_key,headline,description,image_alt,destination_url,
          review_state,created_at
        FROM eut_ads.creatives ORDER BY created_at DESC,id LIMIT 100
      ) q
    ),'[]'::jsonb),
    'assignments', COALESCE((
      SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT id,campaign_id,placement_id,enabled,priority
        FROM eut_ads.campaign_placements ORDER BY created_at DESC,id LIMIT 100
      ) q
    ),'[]'::jsonb),
    'totals', jsonb_build_object(
      'sponsors',(SELECT count(*) FROM eut_ads.sponsors),
      'placements',(SELECT count(*) FROM eut_ads.placements),
      'campaigns',(SELECT count(*) FROM eut_ads.campaigns),
      'creatives',(SELECT count(*) FROM eut_ads.creatives),
      'assignments',(SELECT count(*) FROM eut_ads.campaign_placements)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.eut_ads_admin_snapshot()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_ads_admin_snapshot()
  TO authenticated;

-- Ativação manual da IMAGEM: a campanha só aparecerá quando a cópia pública
-- do arquivo existir, com a referência aprovada e a mesma extensão do original.
CREATE OR REPLACE FUNCTION public.eut_ads_admin_activate_image(
  _campaign_id uuid,_creative_id uuid,_placement_id uuid,_approval_note text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE
  v_admin uuid;
  v_sponsor uuid;
  v_status text;
  v_start timestamptz;
  v_end timestamptz;
  v_price bigint;
  v_private text;
  v_extension text;
  v_public text;
  v_slot text;
  v_route text;
  v_note text := btrim(coalesce(_approval_note,''));
BEGIN
  v_admin:=eut_ads.require_admin();
  IF length(v_note)<16 OR length(v_note)>500 THEN
    RAISE EXCEPTION 'Informe contrato e revisão explícita da imagem (16 a 500 caracteres)';
  END IF;
  IF _campaign_id IS NULL OR _creative_id IS NULL OR _placement_id IS NULL THEN
    RAISE EXCEPTION 'Campanha, imagem e slot obrigatórios';
  END IF;
  SELECT sponsor_id,status,starts_at,ends_at,price_cents
    INTO v_sponsor,v_status,v_start,v_end,v_price
  FROM eut_ads.campaigns WHERE id=_campaign_id FOR UPDATE;
  IF NOT FOUND OR v_status<>'draft' THEN
    RAISE EXCEPTION 'Aprovação disponível somente para campanha em rascunho';
  END IF;
  IF v_start IS NULL OR v_end IS NULL
     OR v_start>statement_timestamp() OR v_end<=statement_timestamp()
     OR v_price IS NULL OR v_price<=0 THEN
    RAISE EXCEPTION 'Preço e período vigente são obrigatórios';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM eut_ads.sponsors
    WHERE id=v_sponsor AND status='contracted'
  ) THEN RAISE EXCEPTION 'Patrocinador contratado é obrigatório'; END IF;

  SELECT cr.media_storage_key INTO v_private
  FROM eut_ads.creatives cr
  WHERE cr.id=_creative_id AND cr.campaign_id=_campaign_id
    AND cr.creative_type='image' AND cr.review_state='draft'
    AND length(btrim(coalesce(cr.image_alt,'')))>=5
    AND length(btrim(coalesce(cr.headline,'')))>=3
    AND cr.public_media_key IS NULL
    AND cr.destination_url ~* '^https://([a-z0-9-]+[.])+[a-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
  FOR UPDATE;
  IF v_private IS NULL OR v_private !~
    '^ads/[0-9a-f-]{36}[.](png|jpg|webp|avif)$' THEN
    RAISE EXCEPTION 'Imagem privada original e revisão acessível obrigatórias';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o WHERE o.bucket_id='eut-ad-assets'
      AND o.name=v_private
      AND lower(coalesce(o.metadata->>'mimetype','')) IN
       ('image/jpeg','image/png','image/webp','image/avif')
  ) THEN RAISE EXCEPTION 'Arquivo original não encontrado na biblioteca privada'; END IF;

  SELECT slot_key,route_pattern INTO v_slot,v_route
  FROM eut_ads.placements
  WHERE id=_placement_id AND state='available'
    AND format='image' AND device_scope='all';
  IF NOT FOUND OR (v_slot,v_route) NOT IN (
    ('home.content_1','/'),
    ('search.top','/tecnicos'),
    ('services.content_1','/servicos')
  ) THEN RAISE EXCEPTION 'Este espaço não permite banners com imagem'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM eut_ads.campaign_placements
    WHERE campaign_id=_campaign_id AND placement_id=_placement_id
      AND enabled=false AND cardinality(uf_targets)=0
      AND cardinality(city_targets)=0
      AND cardinality(category_targets)=0
      AND cardinality(service_targets)=0
  ) THEN RAISE EXCEPTION 'Vínculo de slot desativado e sem segmentação é obrigatório'; END IF;

  v_extension:=substring(v_private FROM '[.](png|jpg|webp|avif)$');
  IF v_extension IS NULL THEN RAISE EXCEPTION 'Extensão de imagem não suportada'; END IF;
  v_public:='approved/'||_creative_id::text||'/'||gen_random_uuid()::text||'.'||v_extension;

  UPDATE eut_ads.creatives SET
    public_media_key=v_public,review_state='approved',
    approved_by=v_admin,approved_at=statement_timestamp(),
    updated_at=statement_timestamp()
    WHERE id=_creative_id AND review_state='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Imagem já aprovada'; END IF;

  UPDATE eut_ads.campaigns SET status='active',
    approved_by=v_admin,approved_at=statement_timestamp(),
    internal_notes=left(concat_ws(E'\n',nullif(internal_notes,''),
      'R5 imagem aprovada: '||v_note),3000),
    updated_at=statement_timestamp()
    WHERE id=_campaign_id AND status='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não ativada'; END IF;

  UPDATE eut_ads.campaign_placements SET enabled=true,
    updated_at=statement_timestamp()
    WHERE campaign_id=_campaign_id AND placement_id=_placement_id
      AND enabled=false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Falha no vínculo da campanha'; END IF;

  RETURN jsonb_build_object('approved',true,'campaign_id',_campaign_id,
    'creative_id',_creative_id,'public_media_key',v_public,'slot_key',v_slot);
END;
$$;
REVOKE ALL ON FUNCTION public.eut_ads_admin_activate_image(uuid,uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_ads_admin_activate_image(uuid,uuid,uuid,text)
  TO authenticated;

-- A projeção NÃO retorna o caminho da mídia privada.
-- Cards anteriores conservam exatamente seus sete campos.
-- Banners de imagem só surgem após COPY existente em bucket público.
CREATE OR REPLACE FUNCTION public.eut_ads_public_slot(_slot_key text,_route_path text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog
AS $$
DECLARE v_result jsonb;
BEGIN
  IF (_slot_key,_route_path) NOT IN (
    ('home.content_1','/'),('search.top','/tecnicos'),
    ('services.content_1','/servicos')
  ) THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'label','Publicidade','brand_name',s.brand_name,
    'headline',COALESCE(NULLIF(btrim(cr.headline),''),s.brand_name),
    'description',COALESCE(cr.description,''),
    'destination_url',cr.destination_url,
    'creative_type',cr.creative_type,'slot_key',p.slot_key
  ) || CASE WHEN cr.creative_type='image'
    THEN jsonb_build_object('public_media_key',cr.public_media_key,
      'image_alt',cr.image_alt)
    ELSE '{}'::jsonb END
  INTO v_result
  FROM eut_ads.placements p
  JOIN eut_ads.campaign_placements cp ON cp.placement_id=p.id
  JOIN eut_ads.campaigns c ON c.id=cp.campaign_id
  JOIN eut_ads.sponsors s ON s.id=c.sponsor_id
  JOIN eut_ads.creatives cr ON cr.campaign_id=c.id
  WHERE p.slot_key=_slot_key AND p.route_pattern=_route_path
    AND p.format IN ('sponsored_card','image')
    AND p.state='available' AND p.device_scope='all'
    AND cp.enabled=true
    AND cardinality(cp.uf_targets)=0 AND cardinality(cp.city_targets)=0
    AND cardinality(cp.category_targets)=0 AND cardinality(cp.service_targets)=0
    AND c.status='active'
    AND c.approved_by IS NOT NULL AND c.approved_at IS NOT NULL
    AND c.starts_at<=statement_timestamp() AND c.ends_at>statement_timestamp()
    AND s.status='contracted'
    AND cr.review_state='approved'
    AND cr.approved_by IS NOT NULL AND cr.approved_at IS NOT NULL
    AND cr.destination_url ~* '^https://([a-z0-9-]+[.])+[a-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    AND (
      (cr.creative_type='sponsored_card' AND p.format='sponsored_card')
      OR
      (cr.creative_type='image' AND p.format='image'
        AND cr.public_media_key IS NOT NULL
        AND length(btrim(coalesce(cr.image_alt,'')))>=5
        AND EXISTS(
          SELECT 1 FROM storage.objects o
          WHERE o.bucket_id='eut-ad-delivery'
            AND o.name=cr.public_media_key
        )
      )
    )
  ORDER BY cp.priority ASC,c.approved_at ASC,cr.id ASC
  LIMIT 1;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.eut_ads_public_slot(text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_ads_public_slot(text,text)
  TO anon,authenticated;

COMMENT ON FUNCTION public.eut_ads_public_slot(text,text)
 IS 'Approved ads only, fixed public routes, no private object keys or contacts; image requires approved delivery copy.';
COMMENT ON FUNCTION public.eut_ads_admin_activate_image(uuid,uuid,uuid,text)
 IS 'Two-phase approved image publication: approved metadata, then authenticated Storage copy to public delivery bucket.';
