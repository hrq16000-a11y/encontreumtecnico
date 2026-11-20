-- Proposta de rollback NÃO DESTRUTIVO, somente após decisão autorizada.
-- Preserva tabela, histórico, responsáveis, RLS e todos os dados existentes.
-- Desabilita mutações e restaura a exibição editorial como no release anterior.
BEGIN;
DO $preflight$
BEGIN
  IF to_regclass('eut_migration.admin_feature_flags') IS NULL
    OR to_regclass('eut_migration.admin_feature_flag_audit') IS NULL
    OR to_regprocedure('public.eut_admin_set_home_public_proof(boolean,boolean,text)') IS NULL
    OR to_regprocedure('public.eut_home_public_proof_visible()') IS NULL
  THEN RAISE EXCEPTION 'Rollback não aplicável; revisar estado' USING ERRCODE='P0001';
  END IF;
  -- Lease dos corpos instalados: não alterar função que outra rodada já mudou.
  IF (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid=
      to_regprocedure('public.eut_home_public_proof_visible()'))
      IS DISTINCT FROM '0bdd617476e6e044c6493cb3ae4ef555'
    OR (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid=
      to_regprocedure('public.eut_admin_set_home_public_proof(boolean,boolean,text)'))
      IS DISTINCT FROM '0591739488553bbd34974cabbc4240c6'
  THEN RAISE EXCEPTION 'Contrato divergente; rollback abortado' USING ERRCODE='P0001';
  END IF;
END;
$preflight$;
REVOKE ALL ON FUNCTION public.eut_admin_set_home_public_proof(boolean,boolean,text)
  FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.eut_home_public_proof_visible()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
  SELECT true;
$function$;
COMMIT;
