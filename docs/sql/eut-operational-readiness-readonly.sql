-- EUT: observatório operacional READ ONLY, 10/11/2026.
-- Não retorna nomes, emails, telefones, IDs individuais ou dados de solicitações.
-- NUNCA interpreta cadastros históricos como técnicos aprovados.
-- Um gate de banco aprovado NÃO prova OAuth E2E, restauração ou DNS.
WITH counts AS (
  SELECT
    (SELECT count(*)::bigint FROM eut_migration.legacy_accounts) AS wp_accounts,
    (SELECT count(*)::bigint FROM eut_migration.legacy_accounts WHERE claim_status='unclaimed') AS wp_accounts_unclaimed,
    (SELECT count(*)::bigint FROM public.legacy_review_profiles) AS historical_profiles,
    (SELECT count(*)::bigint FROM public.legacy_review_profiles
       WHERE kind='candidate' AND source_status='publish' AND demo_candidate IS FALSE) AS eligible_wp_candidates,
    (SELECT count(*)::bigint FROM public.legacy_review_profiles
       WHERE kind='employer' AND source_status='publish') AS eligible_wp_employers,
    (SELECT count(*)::bigint FROM public.eut_legacy_url_routes) AS mapped_historical_routes,
    (SELECT count(*)::bigint FROM public.eut_legacy_url_routes AS route
       JOIN public.legacy_review_profiles AS profile
       ON route.kind=profile.kind AND route.slug=profile.slug
       WHERE profile.demo_candidate IS TRUE) AS demo_routes_exposed,
    (SELECT count(*)::bigint FROM public.legacy_public_archive
       WHERE contact_enabled IS TRUE) AS legacy_contacts_exposed,
    (SELECT count(*)::bigint FROM auth.users) AS auth_users,
    (SELECT count(*)::bigint FROM public.user_roles WHERE role='tecnico') AS technician_roles,
    (SELECT count(*)::bigint FROM public.user_roles WHERE role='cliente') AS client_roles,
    (SELECT count(*)::bigint FROM public.technicians WHERE status='aprovado') AS approved_technicians,
    (SELECT count(*)::bigint FROM public.service_requests) AS new_service_requests,
    (SELECT count(*)::bigint FROM public.legacy_profile_claims WHERE status='vinculado') AS linked_legacy_claims,
    (SELECT count(*)::bigint FROM public.eut_legacy_profile_services) AS confirmed_legacy_services,
    (SELECT count(*)::bigint FROM public.eut_legacy_service_areas) AS confirmed_legacy_areas,
    (SELECT count(*)::bigint FROM public.eut_service_categories WHERE active IS TRUE) AS active_categories,
    (SELECT count(*)::bigint FROM public.eut_service_types WHERE active IS TRUE) AS active_service_types,
    (SELECT count(*)::bigint FROM eut_migration.media_transfer_queue
       WHERE verified_sha256 IS NOT NULL) AS media_sha256_verified
)
SELECT
  *,
  (eligible_wp_candidates + eligible_wp_employers) AS expected_public_legacy_urls,
  (mapped_historical_routes = eligible_wp_candidates + eligible_wp_employers)
    AS all_eligible_historical_urls_mapped,
  (demo_routes_exposed = 0 AND legacy_contacts_exposed = 0)
    AS historical_privacy_invariant,
  (technician_roles > 0 AND client_roles > 0 AND approved_technicians > 0)
    AS both_roles_and_first_public_technician_exist,
  (new_service_requests > 0) AS at_least_one_real_request_exists,
  (confirmed_legacy_services > 0 AND confirmed_legacy_areas > 0)
    AS at_least_one_confirmed_legacy_coverage,
  (media_sha256_verified > 0) AS any_migrated_media_hash_verified,
  FALSE AS oauth_two_real_users_e2e_proven,
  FALSE AS backup_restore_e2e_proven,
  FALSE AS dns_cutover_approved_automatically
FROM counts;

-- Três flags finais são SEMPRE falsas aqui por design:
-- o auditor NÃO pode certificar autenticação real de duas contas,
-- restauração de backup em ambiente isolado nem autorização para DNS.
