-- PROPOSTA ISOLADA. NÃO EXECUTAR NO SUPABASE OFICIAL SEM NOVA AUTORIZAÇÃO.
-- Preparação do vínculo das cotações ao preço comercial do proprietário.
-- Não substitui eut_contact_access_quote/eut_prepare_contact_purchase,
-- não altera a restrição legada 999/2999, não libera contatos ou pagamentos.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('eut_migration.mp_owner_settings') IS NULL
    OR to_regclass('eut_migration.mp_owner_settings_audit') IS NULL
    OR to_regprocedure('public.eut_admin_mp_settings()') IS NULL
    OR to_regprocedure('eut_migration.mp_quote_snapshot_at(timestamp with time zone)') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Preflight de preços Mercado Pago divergente; não instalar'
      USING ERRCODE='P0001';
  END IF;
END;
$preflight$;

-- Somente contratos privilegiados e auditados de cotação/pré-pedido podem
-- chamar este resolvedor privado. _at é para testes determinísticos; uma RPC
-- final deve sempre usar o relógio do servidor (now()), nunca data do cliente.
CREATE FUNCTION eut_migration.mp_quote_snapshot_at(_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $fn$
DECLARE
  v_settings eut_migration.mp_owner_settings%ROWTYPE;
  v_local_time time;
BEGIN
  IF _at IS NULL THEN
    RAISE EXCEPTION 'Horário obrigatório' USING ERRCODE='22023';
  END IF;

  SELECT * INTO STRICT v_settings
  FROM eut_migration.mp_owner_settings WHERE singleton=true;
  v_local_time := (_at AT TIME ZONE 'America/Sao_Paulo')::time;

  -- Preço e versão são lidos da mesma linha/snapshot. Nunca emitir uma
  -- autorização de cobrança: são apenas termos comerciais informativos.
  RETURN jsonb_build_object(
    'quoted_price_cents',CASE WHEN v_local_time>=v_settings.regular_from
      AND v_local_time<v_settings.regular_until THEN v_settings.regular_price_cents
      ELSE v_settings.outside_price_cents END,
    'currency','BRL',
    'price_version',v_settings.version,
    'daily_contact_limit',v_settings.daily_contact_limit,
    'commercial_enabled',v_settings.enabled,
    'payment_available',false,
    'contact_released',false
  );
END;
$fn$;

REVOKE ALL ON FUNCTION eut_migration.mp_quote_snapshot_at(timestamptz)
  FROM PUBLIC,anon,authenticated;

COMMENT ON FUNCTION eut_migration.mp_quote_snapshot_at(timestamptz) IS
  'Interno: snapshot de preço do proprietário. Sem acesso direto de clientes, sem liberação/cobrança.';
COMMIT;

-- Gate futuro, não executado aqui: conferir pg_get_functiondef das duas RPCs
-- legadas; revalidar elegibilidade, limite, intent CHECK e versionamento;
-- só então integrar este snapshot em ambas. Jamais confiar no preço do cliente.
