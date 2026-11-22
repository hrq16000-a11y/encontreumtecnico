-- Encontre um Técnico | rollback de elegibilidade pública de fichas administrativas.
-- Proposta versionada, NÃO EXECUTADA. Aplicação futura exige autorização independente.
-- Mesma função, assinatura, campos públicos, filtros, grants, proprietário e RLS.
-- Sem ler/escrever dados de negócio; somente inspeção do catálogo e substituição de função.
-- Captura de metadados do banco dedicado EUT em 2026-11-22.
-- Baseline pg_proc.prosrc MD5: 6281c5ed1278763d3dfa56538f49ff99
-- Proposta pg_proc.prosrc MD5: beab84411323cf450768fc5f2dc59743
-- Restaura exatamente a definição anterior, podendo reexpor fichas com telefone inválido.
BEGIN;

DO $eut_public_admin_phone_guard$
DECLARE
  v_before pg_catalog.pg_proc%ROWTYPE;
  v_after  pg_catalog.pg_proc%ROWTYPE;
  v_signature CONSTANT text := '_slug text, _category text, _service text, _uf text, _city text, _region text, _limit integer, _offset integer';
  v_acl CONSTANT text := '{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}';
  v_expected_before CONSTANT text := 'beab84411323cf450768fc5f2dc59743';
  v_expected_after  CONSTANT text := '6281c5ed1278763d3dfa56538f49ff99';
  v_original CONSTANT text := E'    AND c.contact_suspended = false\n    AND c.phone_e164 ~ ''^[+]55[1-9]{2}[2-9][0-9]{7,8}$''\n';
  v_replacement CONSTANT text := E'    AND c.contact_suspended = false\n';
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'EUT admin public RPC: unexpected executor';
  END IF;

  SELECT p.* INTO v_before
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'eut_public_admin_technicians'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid) = v_signature;

  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'eut_public_admin_technicians'
      AND p.oid <> v_before.oid
  ) THEN
    RAISE EXCEPTION 'EUT admin public RPC: signature missing or unexpected overload';
  END IF;

  IF pg_catalog.pg_get_userbyid(v_before.proowner) <> 'postgres'
     OR v_before.prokind <> 'f'
     OR v_before.prosecdef IS DISTINCT FROM true
     OR v_before.provolatile <> 's'
     OR v_before.proretset IS DISTINCT FROM true
     OR pg_catalog.pg_get_function_result(v_before.oid) <> 'SETOF jsonb'
     OR v_before.pronargdefaults <> 8
     OR v_before.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR v_before.proacl::text IS DISTINCT FROM v_acl
     OR pg_catalog.has_function_privilege('anon', v_before.oid, 'EXECUTE') IS DISTINCT FROM true
     OR pg_catalog.has_function_privilege('authenticated', v_before.oid, 'EXECUTE') IS DISTINCT FROM true
     OR pg_catalog.has_function_privilege('service_role', v_before.oid, 'EXECUTE') IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'EUT admin public RPC: owner, grants, signature or execution contract drifted';
  END IF;

  IF pg_catalog.md5(v_before.prosrc) <> v_expected_before
     OR (pg_catalog.length(v_before.prosrc) -
         pg_catalog.length(pg_catalog.replace(v_before.prosrc, v_original, '')))
         <> pg_catalog.length(v_original)
     OR pg_catalog.md5(
          pg_catalog.replace(v_before.prosrc, v_original, v_replacement))
         <> v_expected_after
  THEN
    RAISE EXCEPTION 'EUT admin public RPC: definition drifted, no replacement permitted';
  END IF;

  -- Execute only DDL for the exact current function definition, changing one clause.
  -- CREATE OR REPLACE preserves function OID, owner and GRANTs (no RLS/DML).
  EXECUTE pg_catalog.replace(
    pg_catalog.pg_get_functiondef(v_before.oid), v_original, v_replacement
  );

  SELECT p.* INTO v_after
  FROM pg_catalog.pg_proc p
  WHERE p.oid = v_before.oid;

  IF NOT FOUND
     OR pg_catalog.md5(v_after.prosrc) <> v_expected_after
     OR v_after.proowner IS DISTINCT FROM v_before.proowner
     OR v_after.proacl IS DISTINCT FROM v_before.proacl
     OR v_after.proconfig IS DISTINCT FROM v_before.proconfig
     OR v_after.prosecdef IS DISTINCT FROM v_before.prosecdef
     OR v_after.provolatile IS DISTINCT FROM v_before.provolatile
     OR v_after.prorettype IS DISTINCT FROM v_before.prorettype
     OR v_after.proretset IS DISTINCT FROM v_before.proretset
     OR pg_catalog.pg_get_function_identity_arguments(v_after.oid) <> v_signature
  THEN
    RAISE EXCEPTION 'EUT admin public RPC: postcheck failed, transaction must roll back';
  END IF;
END;
$eut_public_admin_phone_guard$;

COMMIT;
