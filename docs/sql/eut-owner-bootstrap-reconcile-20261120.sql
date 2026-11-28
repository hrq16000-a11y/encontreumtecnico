-- PROPOSTA PR #359: NÃO EXECUTAR EM PRODUÇÃO SEM AUTORIZAÇÃO ESPECÍFICA.
-- Atribui ao bootstrap a identidade Google já verificada e já administradora.
-- Não cria papéis, não exibe contatos, não habilita cobrança.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='25s';
SELECT pg_advisory_xact_lock(hashtextextended('eut:project-owner:bootstrap',0));

DO $preflight$
DECLARE v_bootstrap int; v_admins int; v_candidates int;
BEGIN
 IF to_regclass('eut_migration.project_owner_bootstrap') IS NULL
    OR to_regclass('public.user_roles') IS NULL
    OR to_regclass('auth.users') IS NULL
    OR to_regclass('auth.identities') IS NULL
    OR to_regclass('auth.sessions') IS NULL
    OR to_regclass('eut_moderation.blocked_accounts') IS NULL
    OR to_regclass('eut_moderation.blocked_phones') IS NULL
    OR to_regclass('public.eut_technician_private_contacts') IS NULL
    OR to_regclass('eut_migration.mp_owner_bootstrap_audit') IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM pg_class
       WHERE oid='eut_migration.project_owner_bootstrap'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Bootstrap ou RLS divergente' USING ERRCODE='P0001'; END IF;

 SELECT count(*) INTO v_bootstrap FROM eut_migration.project_owner_bootstrap b
  WHERE b.singleton=true AND b.claimed_user_id IS NULL AND b.claimed_at IS NULL
    AND b.owner_email=lower(btrim(b.owner_email)) AND b.owner_email LIKE '%@%';
 SELECT count(*) INTO v_admins FROM public.user_roles
  WHERE role='admin'::public.app_role;
 SELECT count(DISTINCT u.id) INTO v_candidates
 FROM eut_migration.project_owner_bootstrap b
 JOIN auth.users u ON lower(btrim(u.email))=b.owner_email
 JOIN auth.identities i ON i.user_id=u.id
 JOIN public.user_roles r ON r.user_id=u.id AND r.role='admin'::public.app_role
 WHERE b.singleton=true AND b.claimed_user_id IS NULL AND b.claimed_at IS NULL
   AND u.email_confirmed_at IS NOT NULL AND i.provider='google'
   AND lower(coalesce(i.identity_data->>'email',''))=b.owner_email
   AND i.identity_data->>'email_verified'='true'
   AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=u.id
     AND (s.not_after IS NULL OR s.not_after>now()))
   AND NOT EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts m WHERE m.user_id=u.id)
   AND NOT EXISTS(
     SELECT 1 FROM public.eut_technician_private_contacts c
     JOIN eut_moderation.blocked_phones p ON
       p.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
     WHERE c.user_id=u.id);
 IF v_bootstrap<>1 OR v_admins<>1 OR v_candidates<>1
 THEN RAISE EXCEPTION 'Identidade verificada não é única ou reivindicação já realizada'
 USING ERRCODE='P0001'; END IF;
END;
$preflight$;

-- Auditoria restrita ao schema privado, criação e atualização na mesma transação.
CREATE TABLE eut_migration.mp_owner_bootstrap_audit (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 subject_user_id uuid NOT NULL REFERENCES auth.users(id),
 operation text NOT NULL DEFAULT 'reconcile_existing_verified_google_admin'
   CHECK(operation='reconcile_existing_verified_google_admin'),
 executed_by_role text NOT NULL DEFAULT current_user,
 reason text NOT NULL,
 reconciled_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE eut_migration.mp_owner_bootstrap_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_migration.mp_owner_bootstrap_audit FROM PUBLIC,anon,authenticated;

DO $reconcile$
DECLARE v_owner uuid; v_updated int;
BEGIN
 SELECT DISTINCT u.id INTO STRICT v_owner
 FROM eut_migration.project_owner_bootstrap b
 JOIN auth.users u ON lower(btrim(u.email))=b.owner_email
 JOIN auth.identities i ON i.user_id=u.id AND i.provider='google'
   AND lower(coalesce(i.identity_data->>'email',''))=b.owner_email
   AND i.identity_data->>'email_verified'='true'
 JOIN public.user_roles r ON r.user_id=u.id AND r.role='admin'::public.app_role
 WHERE b.singleton=true AND b.claimed_user_id IS NULL AND b.claimed_at IS NULL
   AND u.email_confirmed_at IS NOT NULL
   AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=u.id
     AND (s.not_after IS NULL OR s.not_after>now()))
   AND NOT EXISTS(SELECT 1 FROM eut_moderation.blocked_accounts m WHERE m.user_id=u.id)
   AND NOT EXISTS(
     SELECT 1 FROM public.eut_technician_private_contacts c
     JOIN eut_moderation.blocked_phones p ON
       p.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
     WHERE c.user_id=u.id);
 UPDATE eut_migration.project_owner_bootstrap
 SET claimed_user_id=v_owner, claimed_at=clock_timestamp()
 WHERE singleton=true AND claimed_user_id IS NULL AND claimed_at IS NULL;
 GET DIAGNOSTICS v_updated=ROW_COUNT;
 IF v_updated<>1 THEN RAISE EXCEPTION 'Conflito na atualização do bootstrap' USING ERRCODE='P0001'; END IF;
 INSERT INTO eut_migration.mp_owner_bootstrap_audit(subject_user_id,reason)
 VALUES(v_owner,'Reconciliação autorizada do proprietário Google já admin; execução SQL privilegiada');
 IF NOT EXISTS (SELECT 1 FROM eut_migration.project_owner_bootstrap
    WHERE singleton=true AND claimed_user_id=v_owner AND claimed_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Pós-check transacional falhou' USING ERRCODE='P0001'; END IF;
END;
$reconcile$;
COMMIT;
-- Falha antes do COMMIT => ROLLBACK integral. Após COMMIT, não desfazer
-- automaticamente a identidade. Validar via SELECT e sessão real do proprietário.
