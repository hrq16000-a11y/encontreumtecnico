-- PROPOSTA NÃO EXECUTADA: só aplicar no projeto dedicado com autorização de release.
-- Lista administrativa de clientes importados, com telefone integral exclusivamente
-- para administrador autenticado e confirmado. Mantém RLS e tabelas como estão.
-- Consulta é auditada por telefone efetivamente retornado; sem aprovação de cadastro.
BEGIN;

CREATE OR REPLACE FUNCTION public.eut_admin_imported_clients(
  _search text DEFAULT '',
  _page integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'pg_catalog'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_search text := btrim(coalesce(_search, ''));
  v_digits text := regexp_replace(v_search, '[^0-9]', '', 'g');
  v_page integer := greatest(0, least(coalesce(_page, 0), 10000));
  v_total integer := 0;
  v_clients jsonb := '[]'::jsonb;
BEGIN
  IF v_actor IS NULL
    OR NOT public.has_role(v_actor, 'admin'::public.app_role)
    OR NOT public.eut_account_operational()
    OR NOT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = v_actor AND u.email_confirmed_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Admin confirmado obrigatório' USING ERRCODE = '42501';
  END IF;
  IF length(v_search) > 80 OR v_search ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Busca inválida' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer INTO v_total
  FROM eut_moderation.imported_user_registry r
  WHERE r.role = 'cliente' AND (
    v_search = '' OR r.display_name ILIKE '%' || v_search || '%'
    OR r.region_approx ILIKE '%' || v_search || '%'
    OR r.ddd = v_search
    OR (length(v_digits) >= 3
      AND replace(r.phone_e164, '+', '') LIKE '%' || v_digits || '%')
  );

  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC, p.id DESC), '[]'::jsonb)
    INTO v_clients
  FROM (
    SELECT r.id, r.display_name, r.phone_e164, r.ddd, r.region_approx,
      r.declared_uf, r.admin_active, r.blocked_on_import, r.linked_auth_user_id,
      r.created_at
    FROM eut_moderation.imported_user_registry r
    WHERE r.role = 'cliente' AND (
      v_search = '' OR r.display_name ILIKE '%' || v_search || '%'
      OR r.region_approx ILIKE '%' || v_search || '%'
      OR r.ddd = v_search
      OR (length(v_digits) >= 3
        AND replace(r.phone_e164, '+', '') LIKE '%' || v_digits || '%')
    )
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 20 OFFSET v_page * 20
  ) p;

  -- Audit individual access using the existing allowed 'reveal_phone' action.
  INSERT INTO eut_moderation.contact_audit
    (actor_id, action, reference_id, phone_last4, reason)
  SELECT v_actor, 'reveal_phone', 'imported_client:' || (c->>'id'),
    right(c->>'phone_e164', 4), 'Consulta administrativa de cliente importado'
  FROM jsonb_array_elements(v_clients) c;

  RETURN jsonb_build_object(
    'total', v_total, 'page', v_page, 'page_size', 20, 'clients', v_clients
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.eut_admin_imported_clients(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_admin_imported_clients(text, integer)
  TO authenticated;

-- Não conceder SELECT/UPDATE no índice privado nem alterar políticas RLS.
COMMIT;
