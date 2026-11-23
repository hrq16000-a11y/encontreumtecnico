-- EUT Admin 360 v1.2 | PROPOSAL ONLY — do not execute from CI/chat.
-- Read-only, cursor-paginated USERS query across existing sources.
-- No new table, RLS change, data migration, authentication identity or write command.
-- User identity is stable by existing IDs, never by name, DDD, e-mail or telephone.
-- The output carries exact complete administrative fields when already present.
-- The two administrative user states are ATIVO and SUSPENSO; historical workflow
-- statuses, contact restrictions and demonstration flags remain separate fields.
-- This query is NOT a substitute for the existing audited CRUD RPCs.
-- Deployment prerequisite: confirm all referenced objects/columns on dedicated EUT
-- Supabase, then explicitly authorize application and isolated load/authorization QA.
BEGIN;

CREATE OR REPLACE FUNCTION public.eut_admin_users_unified_360(
  _search text DEFAULT '',
  _state text DEFAULT 'todos',
  _role text DEFAULT 'todos',
  _limit integer DEFAULT 50,
  _after_name text DEFAULT NULL,
  _after_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $rpc$
DECLARE
  v_actor uuid := auth.uid();
  v_search text := pg_catalog.lower(pg_catalog.btrim(coalesce(_search, '')));
  v_digits text := pg_catalog.regexp_replace(coalesce(_search, ''), '[^0-9]', '', 'g');
  v_state text := pg_catalog.lower(pg_catalog.btrim(coalesce(_state, '')));
  v_role text := pg_catalog.lower(pg_catalog.btrim(coalesce(_role, '')));
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
  v_more boolean := false;
  v_next_name text;
  v_next_key text;
BEGIN
  IF v_actor IS NULL
    OR NOT public.has_role(v_actor, 'admin'::public.app_role)
    OR NOT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = v_actor AND u.email_confirmed_at IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM eut_moderation.blocked_accounts ba
      WHERE ba.user_id = v_actor
    )
  THEN
    RAISE EXCEPTION 'Acesso administrativo necessário' USING ERRCODE='42501';
  END IF;

  IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 100
    OR pg_catalog.char_length(v_search) > 80
    OR v_state NOT IN ('todos', 'ativo', 'suspenso')
    OR pg_catalog.char_length(v_role) NOT BETWEEN 1 AND 64
    OR (_after_name IS NULL) IS DISTINCT FROM (_after_key IS NULL)
    OR pg_catalog.char_length(coalesce(_after_name, '')) > 160
    OR pg_catalog.char_length(coalesce(_after_key, '')) > 160
    OR (_after_key IS NOT NULL AND pg_catalog.btrim(_after_key) = '')
  THEN
    RAISE EXCEPTION 'Filtros ou cursor inválidos' USING ERRCODE='22023';
  END IF;

  WITH
  -- One account row per auth.users.id. A linked registry record is represented
  -- here, not listed again, ONLY through the declared portal_technician_id FK.
  accounts AS (
    SELECT
      'account:' || u.id::text AS user_key,
      pg_catalog.lower(n.full_name) AS sort_name,
      n.full_name AS search_name,
      pg_catalog.concat_ws(' ', u.email, i.contact_email,
        (SELECT pg_catalog.string_agg(la.wp_email, ' ')
         FROM eut_migration.legacy_accounts la WHERE la.auth_user_id = u.id)
      ) AS search_email,
      pg_catalog.concat_ws(' ', c.phone_e164, rc.phone_e164,
        (SELECT pg_catalog.string_agg(ir.phone_e164, ' ')
         FROM eut_moderation.imported_user_registry ir
         WHERE ir.linked_auth_user_id = u.id
            OR (r.id IS NOT NULL AND ir.technician_record_id = r.id)),
        (SELECT pg_catalog.string_agg(d.contact_phone, ' ')
         FROM eut_migration.legacy_directory d
         JOIN eut_migration.legacy_accounts la
           ON la.source_key = d.source_key AND la.wp_user_id = d.wp_user_id
         WHERE la.auth_user_id = u.id)
      ) AS search_phone,
      pg_catalog.concat_ws(' ', t.city, t.state_uf, m.name, m.uf) AS search_locality,
      rr.roles AS roles,
      CASE WHEN ba.user_id IS NOT NULL OR t.status::text = 'suspenso'
             OR (r.id IS NOT NULL AND (r.archived_at IS NOT NULL OR NOT r.admin_active))
           THEN 'SUSPENSO' ELSE 'ATIVO' END AS user_state,
      pg_catalog.jsonb_build_object(
        'user_key', 'account:' || u.id::text,
        'record_key', CASE WHEN t.id IS NULL THEN 'account:' || u.id::text
                          ELSE 'portal:' || t.id::text END,
        'auth_user_id', u.id, 'technician_id', t.id,
        'name', n.full_name, 'roles', rr.roles,
        'status', CASE WHEN ba.user_id IS NOT NULL OR t.status::text = 'suspenso'
                         OR (r.id IS NOT NULL AND (r.archived_at IS NOT NULL OR NOT r.admin_active))
                       THEN 'SUSPENSO' ELSE 'ATIVO' END,
        'email', u.email, 'professional_email', i.contact_email,
        'phone', c.phone_e164, 'linked_registry_phone', rc.phone_e164,
        'city', coalesce(m.name, t.city),
        'uf', coalesce(m.uf, t.state_uf),
        'city_ibge_id', r.city_ibge_id,
        'region', coalesce(r.region_approx, t.region),
        'category_slugs', coalesce(r.category_slugs, t.specialties, ARRAY[]::text[]),
        'service_slugs', coalesce(r.service_slugs, t.service_slugs, ARRAY[]::text[]),
        'address', pg_catalog.jsonb_build_object(
          'postal_code', i.address_postal_code, 'street', i.address_street,
          'number', i.address_number, 'complement', i.address_complement,
          'neighborhood', coalesce(i.address_neighborhood, t.neighborhood),
          'city', i.address_city, 'uf', i.address_uf
        ),
        'created_at', u.created_at, 'updated_at', coalesce(r.updated_at, t.updated_at, p.updated_at),
        'technical_status', t.status::text,
        'contact_suspended', rc.contact_suspended,
        'is_demo', r.is_demo,
        'linked_imports', coalesce((
          SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'record_key', 'imported:' || ir.id::text, 'source_id', ir.source_id,
            'technician_record_id', ir.technician_record_id,
            'name', ir.display_name, 'phone', ir.phone_e164,
            'role', ir.role, 'role_basis', ir.role_basis,
            'ddd', ir.ddd, 'region', ir.region_approx,
            'declared_uf', ir.declared_uf, 'import_sources', ir.import_sources,
            'status', CASE WHEN NOT ir.admin_active OR ir.blocked_on_import
                           THEN 'SUSPENSO' ELSE 'ATIVO' END,
            'created_at', ir.created_at, 'updated_at', ir.updated_at
          ) ORDER BY ir.id)
          FROM eut_moderation.imported_user_registry ir
          WHERE ir.linked_auth_user_id = u.id
             OR (r.id IS NOT NULL AND ir.technician_record_id = r.id)
        ), '[]'::jsonb),
        'linked_legacy_accounts', coalesce((
          SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'user_key', 'legacy-account:' || la.source_key || ':' || la.wp_user_id::text,
            'name', la.display_name, 'login', la.wp_login, 'email', la.wp_email,
            'roles', la.roles, 'claim_status', la.claim_status,
            'profiles', coalesce((
              SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'record_key', 'wp:' || d.kind || ':' || d.wp_post_id::text,
                'name', d.title, 'kind', d.kind, 'phone', d.contact_phone,
                'email', d.contact_email, 'specialty', d.specialty_title,
                'registry', (
                  SELECT pg_catalog.jsonb_build_object(
                    'record_key', 'registry:' || tr.id::text,
                    'name', tr.display_name, 'phone', trc.phone_e164,
                    'status', CASE WHEN tr.archived_at IS NOT NULL OR NOT tr.admin_active
                                   THEN 'SUSPENSO' ELSE 'ATIVO' END,
                    'technician_record_id', tr.id
                  )
                  FROM eut_moderation.admin_technician_records tr
                  LEFT JOIN eut_moderation.admin_technician_record_contacts trc
                    ON trc.record_id = tr.id
                  WHERE tr.origin = 'wordpress'
                    AND tr.source_id = d.source_key || ':' || d.wp_post_id::text
                )
              ) ORDER BY d.wp_post_id)
              FROM eut_migration.legacy_directory d
              WHERE d.source_key = la.source_key AND d.wp_user_id = la.wp_user_id
            ), '[]'::jsonb)
          ) ORDER BY la.source_key, la.wp_user_id)
          FROM eut_migration.legacy_accounts la WHERE la.auth_user_id = u.id
        ), '[]'::jsonb)
      ) AS item
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.technicians t ON t.user_id = u.id
    LEFT JOIN eut_moderation.admin_technician_records r ON r.portal_technician_id = t.id
    LEFT JOIN public.eut_ibge_municipalities m ON m.id = r.city_ibge_id
    LEFT JOIN public.eut_technician_private_contacts c ON c.user_id = u.id
    LEFT JOIN eut_moderation.admin_technician_record_contacts rc ON rc.record_id = r.id
    LEFT JOIN eut_moderation.admin_technician_identity i ON i.record_key = 'portal:' || t.id::text
    LEFT JOIN eut_moderation.blocked_accounts ba ON ba.user_id = u.id
    CROSS JOIN LATERAL (
      SELECT coalesce(
        nullif(pg_catalog.btrim(p.full_name), ''),
        nullif(pg_catalog.btrim(t.display_name), ''),
        nullif(pg_catalog.btrim(u.raw_user_meta_data->>'full_name'), ''),
        'Conta sem nome'
      ) AS full_name
    ) n
    CROSS JOIN LATERAL (
      SELECT ARRAY(
        SELECT DISTINCT role_name FROM (
          SELECT ur.role::text AS role_name FROM public.user_roles ur WHERE ur.user_id = u.id
          UNION ALL SELECT 'tecnico'::text WHERE t.id IS NOT NULL
          UNION ALL SELECT pg_catalog.lower(pg_catalog.btrim(ir.role))
            FROM eut_moderation.imported_user_registry ir
            WHERE ir.linked_auth_user_id = u.id
          UNION ALL SELECT pg_catalog.lower(pg_catalog.btrim(x.role_name))
            FROM eut_migration.legacy_accounts la
            CROSS JOIN LATERAL pg_catalog.unnest(la.roles) AS x(role_name)
            WHERE la.auth_user_id = u.id
          UNION ALL SELECT CASE WHEN d.kind = 'candidate' THEN 'tecnico'
                                WHEN d.kind = 'employer' THEN 'cliente' END
            FROM eut_migration.legacy_directory d
            JOIN eut_migration.legacy_accounts la
              ON la.source_key = d.source_key AND la.wp_user_id = d.wp_user_id
            WHERE la.auth_user_id = u.id AND d.kind IN ('candidate', 'employer')
        ) declared_roles WHERE role_name IS NOT NULL
          AND pg_catalog.btrim(role_name) <> '' ORDER BY role_name
      )::text[] AS roles
    ) rr
  ),
  -- A registry row has its own stable identity until an explicit portal FK links it.
  -- No matching by phone, e-mail, name, DDD or guessed municipality.
  registry AS (
    SELECT
      'registry:' || r.id::text AS user_key,
      pg_catalog.lower(r.display_name) AS sort_name,
      r.display_name AS search_name,
      CASE WHEN i.record_key IS NOT NULL THEN i.contact_email
           ELSE ld.contact_email END AS search_email,
      pg_catalog.concat_ws(' ', c.phone_e164,
        (SELECT pg_catalog.string_agg(ir.phone_e164, ' ')
         FROM eut_moderation.imported_user_registry ir
         WHERE ir.technician_record_id = r.id)
      ) AS search_phone,
      pg_catalog.concat_ws(' ', m.name, m.uf, r.region_approx, r.ddd) AS search_locality,
      ARRAY['tecnico']::text[] AS roles,
      CASE WHEN r.archived_at IS NOT NULL OR NOT r.admin_active
           THEN 'SUSPENSO' ELSE 'ATIVO' END AS user_state,
      pg_catalog.jsonb_build_object(
        'user_key', 'registry:' || r.id::text,
        'record_key', 'registry:' || r.id::text,
        'auth_user_id', NULL, 'technician_id', r.id,
        'name', r.display_name, 'roles', ARRAY['tecnico']::text[],
        'status', CASE WHEN r.archived_at IS NOT NULL OR NOT r.admin_active
                       THEN 'SUSPENSO' ELSE 'ATIVO' END,
        'email', CASE WHEN i.record_key IS NOT NULL THEN i.contact_email
                      ELSE ld.contact_email END,
        'phone', c.phone_e164,
        'city', m.name, 'uf', m.uf, 'city_ibge_id', r.city_ibge_id,
        'region', r.region_approx, 'ddd', r.ddd,
        'category_slugs', r.category_slugs, 'service_slugs', r.service_slugs,
        'address', pg_catalog.jsonb_build_object(
          'postal_code', i.address_postal_code, 'street', i.address_street,
          'number', i.address_number, 'complement', i.address_complement,
          'neighborhood', i.address_neighborhood, 'city', i.address_city, 'uf', i.address_uf
        ),
        'created_at', r.created_at, 'updated_at', r.updated_at,
        'contact_suspended', c.contact_suspended, 'is_demo', r.is_demo,
        'archived', r.archived_at IS NOT NULL,
        'linked_imports', coalesce((
          SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'record_key', 'imported:' || ir.id::text, 'source_id', ir.source_id,
            'phone', ir.phone_e164, 'role', ir.role, 'role_basis', ir.role_basis,
            'status', CASE WHEN NOT ir.admin_active OR ir.blocked_on_import
                           THEN 'SUSPENSO' ELSE 'ATIVO' END,
            'import_sources', ir.import_sources
          ) ORDER BY ir.id)
          FROM eut_moderation.imported_user_registry ir
          WHERE ir.technician_record_id = r.id
        ), '[]'::jsonb)
      ) AS item
    FROM eut_moderation.admin_technician_records r
    LEFT JOIN public.technicians linked ON linked.id = r.portal_technician_id
    LEFT JOIN public.eut_ibge_municipalities m ON m.id = r.city_ibge_id
    LEFT JOIN eut_moderation.admin_technician_record_contacts c ON c.record_id = r.id
    LEFT JOIN eut_moderation.admin_technician_identity i ON i.record_key = 'registry:' || r.id::text
    LEFT JOIN eut_migration.legacy_directory ld
      ON r.origin = 'wordpress'
      AND r.source_id ~ '^wordpress_20261108:[0-9]{1,9}$'
      AND ld.source_key = 'wordpress_20261108'
      AND ld.wp_post_id = CASE
        WHEN r.source_id ~ '^wordpress_20261108:[0-9]{1,9}$'
          THEN pg_catalog.split_part(r.source_id, ':', 2)::bigint
        ELSE NULL::bigint
      END
      AND ld.kind = 'candidate'
    WHERE linked.id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM eut_moderation.imported_user_registry ir
        WHERE ir.technician_record_id = r.id AND ir.linked_auth_user_id IS NOT NULL
      )
      -- Suppress a WordPress registry row only when the exact legacy account
      -- represents it. A directory row alone is not an account identity.
      AND NOT EXISTS (
        SELECT 1 FROM eut_migration.legacy_accounts la
        WHERE ld.wp_post_id IS NOT NULL
          AND la.source_key = ld.source_key AND la.wp_user_id = ld.wp_user_id
      )
  ),
  -- WordPress people without an imported registry identity remain users to
  -- manage; employers are clients, candidates are technicians. Demonstrations
  -- are marked, not activated. Import provenance is not a user role.
  historical AS (
    SELECT
      'wp:' || h.kind || ':' || h.wp_post_id::text AS user_key,
      pg_catalog.lower(n.full_name) AS sort_name,
      n.full_name AS search_name,
      CASE WHEN i.record_key IS NOT NULL THEN i.contact_email
           ELSE ld.contact_email END AS search_email,
      ld.contact_phone AS search_phone,
      pg_catalog.concat_ws(' ', h.location1, h.location2, h.location3) AS search_locality,
      CASE WHEN h.kind = 'candidate' THEN ARRAY['tecnico']::text[]
           ELSE ARRAY['cliente']::text[] END AS roles,
      CASE WHEN h.demo_candidate OR coalesce(tm.record_state, em.record_state) = 'excluido'
           THEN 'SUSPENSO' ELSE 'ATIVO' END AS user_state,
      pg_catalog.jsonb_build_object(
        'user_key', 'wp:' || h.kind || ':' || h.wp_post_id::text,
        'record_key', 'wp:' || h.kind || ':' || h.wp_post_id::text,
        'auth_user_id', NULL, 'technician_id', NULL,
        'name', n.full_name,
        'roles', CASE WHEN h.kind = 'candidate' THEN ARRAY['tecnico']::text[]
                      ELSE ARRAY['cliente']::text[] END,
        'status', CASE WHEN h.demo_candidate OR coalesce(tm.record_state, em.record_state) = 'excluido'
                       THEN 'SUSPENSO' ELSE 'ATIVO' END,
        'email', CASE WHEN i.record_key IS NOT NULL THEN i.contact_email
                      ELSE ld.contact_email END,
        'phone', ld.contact_phone,
        'city', NULL, 'uf', NULL, 'city_ibge_id', NULL,
        'localidade_informada', pg_catalog.concat_ws(' ', h.location1, h.location2, h.location3),
        'specialty_label', h.specialty_title,
        'category_slugs', ARRAY[]::text[], 'service_slugs', ARRAY[]::text[],
        'created_at', NULL, 'imported_at', h.imported_at,
        'updated_at', coalesce(tm.updated_at, em.updated_at),
        'is_demo', h.demo_candidate
      ) AS item
    FROM public.legacy_review_profiles h
    LEFT JOIN eut_migration.legacy_directory ld
      ON ld.source_key = h.source_key AND ld.wp_post_id = h.wp_post_id
         AND ld.kind = h.kind
    LEFT JOIN public.eut_legacy_profile_management tm
      ON tm.source_key = h.source_key AND tm.wp_post_id = h.wp_post_id
         AND h.kind = 'candidate'
    LEFT JOIN public.eut_legacy_employer_management em
      ON em.source_key = h.source_key AND em.wp_post_id = h.wp_post_id
         AND h.kind = 'employer'
    LEFT JOIN eut_moderation.admin_technician_identity i
      ON i.record_key = 'wp:candidate:' || h.wp_post_id::text AND h.kind = 'candidate'
    CROSS JOIN LATERAL (
      SELECT coalesce(
        nullif(pg_catalog.btrim(tm.corrected_name), ''),
        nullif(pg_catalog.btrim(em.corrected_name), ''),
        nullif(pg_catalog.btrim(h.title), ''),
        'Usuário sem nome'
      ) AS full_name
    ) n
    WHERE h.source_key = 'wordpress_20261108'
      AND h.kind IN ('candidate', 'employer')
      AND NOT EXISTS (
        SELECT 1 FROM eut_moderation.admin_technician_records r
        WHERE r.origin = 'wordpress'
          AND r.source_id = h.source_key || ':' || h.wp_post_id::text
      )
      -- An exact WP post/account foreign key means the post is a profile
      -- of legacy_accounts (or an Auth-linked legacy account), not another user.
      AND NOT EXISTS (
        SELECT 1 FROM eut_migration.legacy_directory d
        JOIN eut_migration.legacy_accounts la
          ON la.source_key = d.source_key AND la.wp_user_id = d.wp_user_id
        WHERE d.source_key = h.source_key AND d.wp_post_id = h.wp_post_id
      )
  ),
  -- Imported registry entries without either established Auth/technical FK.
  imported AS (
    SELECT
      'imported:' || ir.id::text AS user_key,
      pg_catalog.lower(ir.display_name) AS sort_name,
      ir.display_name AS search_name,
      NULL::text AS search_email,
      ir.phone_e164 AS search_phone,
      pg_catalog.concat_ws(' ', ir.ddd, ir.region_approx, ir.declared_uf) AS search_locality,
      CASE WHEN pg_catalog.btrim(ir.role) = '' THEN ARRAY[]::text[]
           ELSE ARRAY[pg_catalog.lower(pg_catalog.btrim(ir.role))]::text[] END AS roles,
      CASE WHEN NOT ir.admin_active OR ir.blocked_on_import
           THEN 'SUSPENSO' ELSE 'ATIVO' END AS user_state,
      pg_catalog.jsonb_build_object(
        'user_key', 'imported:' || ir.id::text,
        'record_key', 'imported:' || ir.id::text,
        'auth_user_id', NULL, 'technician_id', NULL,
        'name', ir.display_name,
        'roles', CASE WHEN pg_catalog.btrim(ir.role) = '' THEN ARRAY[]::text[]
                      ELSE ARRAY[pg_catalog.lower(pg_catalog.btrim(ir.role))]::text[] END,
        'status', CASE WHEN NOT ir.admin_active OR ir.blocked_on_import
                       THEN 'SUSPENSO' ELSE 'ATIVO' END,
        'email', NULL, 'phone', ir.phone_e164,
        'ddd', ir.ddd, 'region', ir.region_approx, 'declared_uf', ir.declared_uf,
        'import_sources', ir.import_sources, 'role_basis', ir.role_basis,
        'source_id', ir.source_id,
        'created_at', ir.created_at, 'updated_at', ir.updated_at
      ) AS item
    FROM eut_moderation.imported_user_registry ir
    WHERE ir.linked_auth_user_id IS NULL AND ir.technician_record_id IS NULL
  ),
  -- Legacy WP login identities with nested profiles linked by real FK.
  legacy_accounts AS (
    SELECT
      'legacy-account:' || la.source_key || ':' || la.wp_user_id::text AS user_key,
      pg_catalog.lower(n.full_name) AS sort_name,
      n.full_name AS search_name,
      la.wp_email AS search_email,
      (SELECT pg_catalog.string_agg(d.contact_phone, ' ')
       FROM eut_migration.legacy_directory d
       WHERE d.source_key = la.source_key AND d.wp_user_id = la.wp_user_id) AS search_phone,
      (SELECT pg_catalog.string_agg(pg_catalog.concat_ws(' ',d.location1,d.location2,d.location3),' ')
       FROM eut_migration.legacy_directory d
       WHERE d.source_key = la.source_key AND d.wp_user_id = la.wp_user_id) AS search_locality,
      rr.roles AS roles,
      'ATIVO'::text AS user_state,
      pg_catalog.jsonb_build_object(
        'user_key', 'legacy-account:' || la.source_key || ':' || la.wp_user_id::text,
        'record_key', 'legacy-account:' || la.source_key || ':' || la.wp_user_id::text,
        'auth_user_id', NULL, 'technician_id', NULL,
        'name', n.full_name, 'roles', rr.roles, 'status', 'ATIVO',
        'email', la.wp_email, 'login', la.wp_login, 'legacy_roles', la.roles,
        'claim_status', la.claim_status, 'imported_at', la.imported_at,
        'profiles', coalesce((
          SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'record_key', 'wp:' || d.kind || ':' || d.wp_post_id::text,
            'name', d.title, 'kind', d.kind, 'phone', d.contact_phone,
            'email', d.contact_email, 'specialty', d.specialty_title,
            'registry', (
              SELECT pg_catalog.jsonb_build_object(
                'record_key', 'registry:' || tr.id::text,
                'name', tr.display_name, 'phone', trc.phone_e164,
                'status', CASE WHEN tr.archived_at IS NOT NULL OR NOT tr.admin_active
                               THEN 'SUSPENSO' ELSE 'ATIVO' END,
                'technician_record_id', tr.id
              )
              FROM eut_moderation.admin_technician_records tr
              LEFT JOIN eut_moderation.admin_technician_record_contacts trc
                ON trc.record_id = tr.id
              WHERE tr.origin = 'wordpress'
                AND tr.source_id = d.source_key || ':' || d.wp_post_id::text
            ),
            'location', pg_catalog.concat_ws(' ',d.location1,d.location2,d.location3),
            'source_status', d.source_status, 'review_status', d.review_status
          ) ORDER BY d.wp_post_id)
          FROM eut_migration.legacy_directory d
          WHERE d.source_key = la.source_key AND d.wp_user_id = la.wp_user_id
        ), '[]'::jsonb)
      ) AS item
    FROM eut_migration.legacy_accounts la
    CROSS JOIN LATERAL (
      SELECT coalesce(nullif(pg_catalog.btrim(la.display_name), ''),
                      nullif(pg_catalog.btrim(la.wp_login), ''),
                      'Usuário sem nome') AS full_name
    ) n
    CROSS JOIN LATERAL (
      SELECT ARRAY(
        SELECT DISTINCT role_name FROM (
          SELECT pg_catalog.lower(pg_catalog.btrim(x.role_name)) AS role_name
          FROM pg_catalog.unnest(la.roles) AS x(role_name)
          UNION ALL
          SELECT CASE WHEN d.kind = 'candidate' THEN 'tecnico'
                      WHEN d.kind = 'employer' THEN 'cliente' END
          FROM eut_migration.legacy_directory d
          WHERE d.source_key = la.source_key AND d.wp_user_id = la.wp_user_id
            AND d.kind IN ('candidate', 'employer')
        ) declared WHERE role_name IS NOT NULL
          AND pg_catalog.btrim(role_name) <> '' ORDER BY role_name
      )::text[] AS roles
    ) rr
    WHERE la.auth_user_id IS NULL
  ),
  unioned AS (
    SELECT * FROM accounts
    UNION ALL SELECT * FROM registry
    UNION ALL SELECT * FROM historical
    UNION ALL SELECT * FROM imported
    UNION ALL SELECT * FROM legacy_accounts
  ),
  eligible AS (
    SELECT * FROM unioned x
    WHERE (v_state = 'todos' OR pg_catalog.lower(x.user_state) = v_state)
      AND (v_role = 'todos' OR v_role = ANY(x.roles))
      AND (
        -- Deep links use the complete immutable identity, never a name or substring.
        (pg_catalog.left(v_search, 3) = 'id:'
         AND x.user_key = pg_catalog.substr(v_search, 4))
        OR (pg_catalog.left(v_search, 3) <> 'id:'
          AND (v_search = ''
            OR pg_catalog.strpos(pg_catalog.lower(x.search_name), v_search) > 0
            OR pg_catalog.strpos(pg_catalog.lower(coalesce(x.search_email, '')), v_search) > 0
            OR pg_catalog.strpos(pg_catalog.lower(coalesce(x.search_locality, '')), v_search) > 0
            OR pg_catalog.strpos(x.user_key, v_search) > 0
            OR (pg_catalog.char_length(v_digits) >= 3
                AND pg_catalog.strpos(
                  pg_catalog.regexp_replace(coalesce(x.search_phone, ''), '[^0-9]', '', 'g'),
                  v_digits
                ) > 0)))
      )
  ),
  numbered AS (
    SELECT pg_catalog.row_number() OVER (ORDER BY z.sort_name, z.user_key) AS position,
           z.sort_name, z.user_key, z.item
    FROM (
      SELECT sort_name, user_key, item FROM eligible e
      WHERE _after_name IS NULL
        OR (e.sort_name, e.user_key) > (_after_name, _after_key)
      ORDER BY sort_name, user_key
      LIMIT (_limit + 1)
    ) z
  )
  SELECT
    (SELECT pg_catalog.count(*)::bigint FROM eligible),
    coalesce(
      pg_catalog.jsonb_agg(n.item ORDER BY n.position)
        FILTER (WHERE n.position <= _limit), '[]'::jsonb),
    coalesce(pg_catalog.bool_or(n.position > _limit), false),
    pg_catalog.max(n.sort_name) FILTER (WHERE n.position = _limit),
    pg_catalog.max(n.user_key) FILTER (WHERE n.position = _limit)
  INTO v_total, v_items, v_more, v_next_name, v_next_key
  FROM numbered n;

  RETURN pg_catalog.jsonb_build_object(
    'total', v_total, 'limit', _limit, 'items', v_items, 'has_more', v_more,
    'next_cursor', CASE WHEN v_more THEN
      pg_catalog.jsonb_build_object('after_name', v_next_name, 'after_key', v_next_key)
    ELSE NULL END
  );
END;
$rpc$;

REVOKE ALL ON FUNCTION public.eut_admin_users_unified_360(
  text, text, text, integer, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_users_unified_360(
  text, text, text, integer, text, text
) TO authenticated;

COMMIT;
