-- Read-only administrative client indicators and paginated audit.
-- No data migration, no identity or restriction modifications.
-- Deliberately no direct table grants for anon/authenticated.
BEGIN;

CREATE OR REPLACE FUNCTION public.eut_admin_client_insights(
  _audit_filter text DEFAULT 'todos',
  _page integer DEFAULT 0,
  _subject_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'pg_catalog'
AS $function$
DECLARE
  v_filter text := coalesce(_audit_filter, 'todos');
  v_page integer := greatest(0, least(coalesce(_page, 0), 10000));
  v_total_clients integer := 0;
  v_confirmed integer := 0;
  v_blocked integer := 0;
  v_pending_invites integer := 0;
  v_audit_total integer := 0;
  v_audit_rows jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     OR NOT public.eut_account_operational() THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado'
      USING ERRCODE = '42501';
  END IF;

  IF v_filter NOT IN ('todos', 'contas', 'convites', 'bloqueios') THEN
    RAISE EXCEPTION 'Filtro de histórico inválido'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE u.email_confirmed_at IS NOT NULL)::integer,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM eut_moderation.blocked_accounts b
           WHERE b.user_id = clients.user_id
         ) OR EXISTS (
           SELECT 1 FROM public.eut_technician_private_contacts c
           JOIN eut_moderation.blocked_phones b ON b.phone_digits =
             regexp_replace(coalesce(c.phone_e164,''), '[^0-9]', '', 'g')
           WHERE c.user_id = clients.user_id
         ))::integer
    INTO v_total_clients, v_confirmed, v_blocked
    FROM (SELECT DISTINCT user_id FROM public.user_roles
          WHERE role = 'cliente'::public.app_role) clients
    JOIN auth.users u ON u.id = clients.user_id;

  SELECT count(*)::integer INTO v_pending_invites
  FROM eut_moderation.member_invitations
  WHERE target_role = 'cliente'::public.app_role
    AND status = 'pending' AND expires_at > now();

  WITH all_events AS (
    SELECT a.id, a.created_at, 'bloqueios'::text AS kind,
           a.action, a.subject_user_id AS subject_user_id,
           left(coalesce(a.reason, ''), 160) AS reason
    FROM eut_moderation.contact_audit a
    WHERE a.subject_user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.user_roles r
                  WHERE r.user_id = a.subject_user_id
                  AND r.role = 'cliente'::public.app_role)
    UNION ALL
    SELECT a.id, a.created_at,
           CASE WHEN a.action LIKE 'member_invite_%'
                THEN 'convites' ELSE 'contas' END AS kind,
           a.action,
           CASE WHEN EXISTS (
             SELECT 1 FROM public.user_roles r WHERE r.role = 'cliente'::public.app_role
             AND r.user_id::text = a.target_key
           ) THEN a.target_key::uuid ELSE NULL::uuid END AS subject_user_id,
           left(coalesce(a.reason, ''), 160) AS reason
    FROM public.eut_admin_management_log a
    WHERE a.target_type = 'account'
      AND (
        a.before_state->>'role' = 'cliente'
        OR a.after_state->>'role' = 'cliente'
        OR EXISTS (SELECT 1 FROM public.user_roles r
                   WHERE r.role = 'cliente'::public.app_role
                   AND r.user_id::text = a.target_key)
      )
  ), filtered AS MATERIALIZED (
    SELECT * FROM all_events
    WHERE (v_filter = 'todos' OR kind = v_filter)
      AND (_subject_user_id IS NULL OR subject_user_id = _subject_user_id)
  )
  SELECT (SELECT count(*)::integer FROM filtered),
         coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC)
           FROM (
             SELECT id, created_at, kind, action, subject_user_id, reason
             FROM filtered
             ORDER BY created_at DESC, id DESC, kind
             LIMIT 20 OFFSET v_page*20
           ) x), '[]'::jsonb)
  INTO v_audit_total, v_audit_rows;

  RETURN jsonb_build_object(
    'clients_total', v_total_clients,
    'clients_confirmed', v_confirmed,
    'clients_unconfirmed', v_total_clients-v_confirmed,
    'clients_restricted', v_blocked,
    'pending_client_invites', v_pending_invites,
    'audit_filter', v_filter,
    'audit_total', v_audit_total,
    'audit_page', v_page,
    'audit_page_size', 20,
    'audit', v_audit_rows
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.eut_admin_client_insights(text, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_client_insights(text, integer, uuid)
  TO authenticated;

DO $verify$
BEGIN
  IF has_function_privilege('anon',
     'public.eut_admin_client_insights(text,integer,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous access must remain revoked';
  END IF;
  IF has_table_privilege('authenticated','eut_moderation.member_invitations','SELECT') THEN
    RAISE EXCEPTION 'Private invitations must stay restricted';
  END IF;
END
$verify$;
COMMIT;
