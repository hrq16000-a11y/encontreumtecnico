-- Public projection of owner-authorized, admin-managed technicians without Auth accounts.
-- Private contact numbers remain ONLY in eut_moderation.admin_technician_record_contacts.
BEGIN;

ALTER TABLE eut_moderation.admin_technician_records
  ADD COLUMN IF NOT EXISTS declared_uf text,
  ADD COLUMN IF NOT EXISTS coverage_notes text,
  ADD COLUMN IF NOT EXISTS covers_entire_uf boolean NOT NULL DEFAULT false;

ALTER TABLE eut_moderation.admin_technician_records
  ADD CONSTRAINT admin_technician_records_declared_uf_check
  CHECK (declared_uf IS NULL OR declared_uf ~ '^[A-Z]{2}$');

CREATE TABLE IF NOT EXISTS eut_moderation.admin_technician_coverage (
  record_id uuid NOT NULL REFERENCES eut_moderation.admin_technician_records(id) ON DELETE CASCADE,
  city_ibge_id integer NOT NULL REFERENCES public.eut_ibge_municipalities(id),
  PRIMARY KEY (record_id,city_ibge_id)
);
ALTER TABLE eut_moderation.admin_technician_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.admin_technician_coverage FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS eut_moderation.owner_authorized_import_log (
  batch_key text PRIMARY KEY,
  authorization_note text NOT NULL,
  imported_records integer NOT NULL,
  deduplicated_records integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE eut_moderation.owner_authorized_import_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON eut_moderation.owner_authorized_import_log FROM PUBLIC, anon, authenticated;

-- This function is an intentionally narrow, explicit PUBLIC read contract.
-- It never returns a phone, account identifier, source, moderation reason, or email.
CREATE OR REPLACE FUNCTION public.eut_public_admin_technicians(
  _slug text DEFAULT NULL,
  _category text DEFAULT NULL,
  _service text DEFAULT NULL,
  _uf text DEFAULT NULL,
  _city text DEFAULT NULL,
  _region text DEFAULT NULL,
  _limit integer DEFAULT 200,
  _offset integer DEFAULT 0
) RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog AS $rpc$
  SELECT jsonb_build_object(
    'id', r.id,
    'public_slug', 'tecnico-' || replace(r.id::text, '-', ''),
    'display_name', r.display_name,
    'specialties', r.category_slugs,
    'service_slugs', r.service_slugs,
    'city', coalesce(base.name, 'Município não informado'),
    'state_uf', coalesce(base.uf, r.declared_uf),
    'covers_entire_state', r.covers_entire_uf,
    'neighborhood', NULL,
    'region', coalesce(NULLIF(r.coverage_notes, ''), r.region_approx),
    'bio', NULL,
    'avatar_path', NULL,
    'service_radius_km', NULL,
    'coverage_city_ids', coalesce((SELECT jsonb_agg(cover.city_ibge_id ORDER BY cover.city_ibge_id)
      FROM eut_moderation.admin_technician_coverage cover WHERE cover.record_id=r.id), '[]'::jsonb)
  )
  FROM eut_moderation.admin_technician_records r
  JOIN eut_moderation.admin_technician_record_contacts c ON c.record_id=r.id
  LEFT JOIN public.eut_ibge_municipalities base ON base.id=r.city_ibge_id
  WHERE r.admin_active = true AND r.is_demo = false AND r.archived_at IS NULL
    AND c.contact_suspended = false
    AND NOT EXISTS (SELECT 1 FROM eut_moderation.blocked_phones b
      WHERE b.phone_digits=regexp_replace(c.phone_e164,'[^0-9]','','g'))
    AND (_slug IS NULL OR 'tecnico-' || replace(r.id::text, '-', '') = _slug)
    AND (_category IS NULL OR _category = ANY(r.category_slugs))
    AND (_service IS NULL OR _service = ANY(r.service_slugs))
    AND (_uf IS NULL OR base.uf = _uf OR r.declared_uf = _uf OR EXISTS (
      SELECT 1 FROM eut_moderation.admin_technician_coverage ac
      JOIN public.eut_ibge_municipalities m ON m.id=ac.city_ibge_id
      WHERE ac.record_id=r.id AND m.uf=_uf))
    AND (_city IS NULL OR base.name ILIKE '%' || _city || '%' OR
      (r.covers_entire_uf AND coalesce(base.uf,r.declared_uf)=_uf) OR EXISTS (
      SELECT 1 FROM eut_moderation.admin_technician_coverage ac
      JOIN public.eut_ibge_municipalities m ON m.id=ac.city_ibge_id
      WHERE ac.record_id=r.id AND m.name ILIKE '%' || _city || '%'))
    AND (_region IS NULL OR coalesce(r.coverage_notes,r.region_approx,'') ILIKE '%' || _region || '%')
  ORDER BY r.created_at DESC,r.id
  LIMIT least(greatest(coalesce(_limit,200),1),200)
  OFFSET greatest(coalesce(_offset,0),0);
$rpc$;

REVOKE ALL ON FUNCTION public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_public_admin_technicians(text,text,text,text,text,text,integer,integer)
  TO anon, authenticated;

COMMIT;
