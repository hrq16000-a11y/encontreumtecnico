-- Encontre um Técnico — R2 | Patrocínios: núcleo privado.
-- Nenhum slot, anunciante ou campanha é inserido/publicado por esta migração.
-- Sem DDL em supabase/migrations/ (padrão do AGENTS.md); aplicar via Supabase MCP
-- após os gates e preservar este arquivo como contrato auditável no GitHub.
-- Acesso pelo navegador e Data API: negado nesta rodada. CRUD via RPC controlada
-- virá em R3; renderização pública explicitamente segura somente em R4.

CREATE SCHEMA eut_ads;
REVOKE ALL ON SCHEMA eut_ads FROM PUBLIC, anon, authenticated;

CREATE TABLE eut_ads.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL CHECK (length(btrim(brand_name)) BETWEEN 2 AND 120),
  legal_name text CHECK (legal_name IS NULL OR length(btrim(legal_name)) BETWEEN 2 AND 180),
  tax_id_digits text CHECK (tax_id_digits IS NULL OR tax_id_digits ~ '^[0-9]{14}$'),
  contact_email text CHECK (contact_email IS NULL OR (length(contact_email) <= 254 AND contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
  contact_phone_e164 text CHECK (contact_phone_e164 IS NULL OR contact_phone_e164 ~ '^\+55[1-9]{2}[2-9][0-9]{7,8}$'),
  website_url text CHECK (website_url IS NULL OR (length(website_url) <= 2048 AND website_url ~ '^https://[^[:space:]]+$')),
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect','negotiating','contracted','paused','archived')),
  internal_notes text NOT NULL DEFAULT '' CHECK (length(internal_notes) <= 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE eut_ads.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL UNIQUE CHECK (slot_key ~ '^[a-z][a-z0-9_.-]{2,95}$'),
  route_pattern text NOT NULL CHECK (left(route_pattern,1)='/' AND length(route_pattern) <= 180),
  position_label text NOT NULL CHECK (length(btrim(position_label)) BETWEEN 2 AND 120),
  format text NOT NULL CHECK (format IN ('image','sponsored_card','video','carousel')),
  device_scope text NOT NULL DEFAULT 'all' CHECK (device_scope IN ('all','desktop','mobile')),
  width_px integer CHECK (width_px IS NULL OR width_px BETWEEN 120 AND 2400),
  height_px integer CHECK (height_px IS NULL OR height_px BETWEEN 50 AND 1600),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','available','paused','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Atribuição real ao site ainda não existe; 'available' não publica nada.
  CONSTRAINT placements_no_private_area CHECK (
    route_pattern !~ '^/(admin|entrar|area-cliente|area-tecnico|reivindicar-cadastro|redefinir-senha|lp2/admin)(/|$)'
  )
);

CREATE TABLE eut_ads.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES eut_ads.sponsors(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','scheduled','active','paused','expired','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  pricing_model text NOT NULL DEFAULT 'fixed' CHECK (pricing_model IN ('fixed','cpm','cpc','package')),
  price_cents bigint CHECK (price_cents IS NULL OR price_cents >= 0),
  budget_limit_cents bigint CHECK (budget_limit_cents IS NULL OR budget_limit_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'BRL' CHECK (currency='BRL'),
  approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  internal_notes text NOT NULL DEFAULT '' CHECK (length(internal_notes) <= 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),
  CHECK (status NOT IN ('approved','scheduled','active')
         OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK (status NOT IN ('scheduled','active')
         OR (starts_at IS NOT NULL AND ends_at IS NOT NULL))
);

CREATE TABLE eut_ads.creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES eut_ads.campaigns(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
  creative_type text NOT NULL CHECK (creative_type IN ('image','sponsored_card','video')),
  media_storage_key text CHECK (
    media_storage_key IS NULL OR
    (length(media_storage_key) BETWEEN 5 AND 400 AND media_storage_key ~ '^[a-zA-Z0-9_./-]+$' AND media_storage_key !~ '(^|/)\.\.(/|$)')
  ),
  headline text CHECK (headline IS NULL OR length(headline) <= 150),
  description text CHECK (description IS NULL OR length(description) <= 400),
  image_alt text CHECK (image_alt IS NULL OR length(image_alt) <= 240),
  destination_url text NOT NULL CHECK (
    length(destination_url) <= 2048 AND
    destination_url ~ '^https://[^[:space:]]+$'
  ),
  review_state text NOT NULL DEFAULT 'draft'
    CHECK (review_state IN ('draft','in_review','approved','rejected','archived')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (creative_type='sponsored_card' OR media_storage_key IS NOT NULL),
  CHECK (review_state <> 'approved'
         OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE eut_ads.campaign_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES eut_ads.campaigns(id) ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES eut_ads.placements(id) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 1000),
  uf_targets text[] NOT NULL DEFAULT ARRAY[]::text[],
  city_targets text[] NOT NULL DEFAULT ARRAY[]::text[],
  category_targets text[] NOT NULL DEFAULT ARRAY[]::text[],
  service_targets text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id,placement_id),
  CHECK (cardinality(uf_targets) <= 27),
  CHECK (cardinality(city_targets) <= 200),
  CHECK (cardinality(category_targets) <= 200),
  CHECK (cardinality(service_targets) <= 300)
);

CREATE TABLE eut_ads.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('ads_manager','ads_analyst','ads_finance')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,role)
);

CREATE TABLE eut_ads.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  entity_name text NOT NULL,
  entity_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE'))
  -- Never store original/new commercial contacts or personal-data snapshots.
);

-- Write-only, internal trigger with privileged owner and controlled path.
CREATE FUNCTION eut_ads.capture_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog
AS $$
BEGIN
  INSERT INTO eut_ads.audit_events (actor_id,entity_name,entity_id,operation)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP
  );
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION eut_ads.capture_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_sponsors AFTER INSERT OR UPDATE OR DELETE ON eut_ads.sponsors FOR EACH ROW EXECUTE FUNCTION eut_ads.capture_change();
CREATE TRIGGER audit_placements AFTER INSERT OR UPDATE OR DELETE ON eut_ads.placements FOR EACH ROW EXECUTE FUNCTION eut_ads.capture_change();
CREATE TRIGGER audit_campaigns AFTER INSERT OR UPDATE OR DELETE ON eut_ads.campaigns FOR EACH ROW EXECUTE FUNCTION eut_ads.capture_change();
CREATE TRIGGER audit_creatives AFTER INSERT OR UPDATE OR DELETE ON eut_ads.creatives FOR EACH ROW EXECUTE FUNCTION eut_ads.capture_change();
CREATE TRIGGER audit_campaign_placements AFTER INSERT OR UPDATE OR DELETE ON eut_ads.campaign_placements FOR EACH ROW EXECUTE FUNCTION eut_ads.capture_change();
CREATE TRIGGER audit_staff_roles AFTER INSERT OR UPDATE OR DELETE ON eut_ads.staff_roles FOR EACH ROW EXECUTE FUNCTION eut_ads.capture_change();

CREATE INDEX ads_campaigns_sponsor_idx ON eut_ads.campaigns(sponsor_id,status);
CREATE INDEX ads_campaigns_window_idx ON eut_ads.campaigns(starts_at,ends_at);
CREATE INDEX ads_creatives_campaign_idx ON eut_ads.creatives(campaign_id,review_state);
CREATE INDEX ads_assignments_placement_idx ON eut_ads.campaign_placements(placement_id,enabled);
CREATE INDEX ads_audit_events_time_idx ON eut_ads.audit_events(occurred_at DESC);

-- Defense in depth: RLS and no direct privileges/policies in R2.
-- No Data API exposure, no direct table access by anon/authenticated.
ALTER TABLE eut_ads.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.sponsors FORCE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.placements FORCE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.creatives FORCE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.campaign_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.campaign_placements FORCE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.staff_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_ads.audit_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA eut_ads FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA eut_ads FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA eut_ads FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SCHEMA eut_ads FROM PUBLIC,anon,authenticated;

COMMENT ON SCHEMA eut_ads IS 'EUT ads internal R2. No public Data API grants or live advertising; CRUD R3 and delivery R4.';
COMMENT ON TABLE eut_ads.sponsors IS 'Private sponsor CRM. Contact fields never public.';
COMMENT ON TABLE eut_ads.placements IS 'Internal ad inventory. Not rendered until R4.';
COMMENT ON TABLE eut_ads.campaigns IS 'Campaigns cannot become approved or active without review evidence.';
COMMENT ON TABLE eut_ads.creatives IS 'No arbitrary HTML/JavaScript; HTTPS destination and controlled storage reference.';
COMMENT ON TABLE eut_ads.audit_events IS 'Actor + entity + operation only; do not log sensitive before/after payloads.';
