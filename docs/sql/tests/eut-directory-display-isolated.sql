\set ON_ERROR_STOP on
-- Execute ONLY against an empty disposable PostgreSQL 17 database.
-- Every identity, session, email and settings row below is synthetic.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA eut_migration;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id));
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb, '{}'::jsonb);
$f$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT nullif(auth.jwt()->>'sub','')::uuid;
$f$;
CREATE TYPE public.app_role AS ENUM ('admin','tecnico','cliente');
CREATE TABLE public.user_roles (user_id uuid NOT NULL, role public.app_role NOT NULL);
CREATE TABLE public.test_account_operational (user_id uuid PRIMARY KEY, operational boolean NOT NULL);
CREATE FUNCTION public.has_role(_user uuid, _role public.app_role) RETURNS boolean
  LANGUAGE sql STABLE AS $f$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user AND role=_role);
$f$;
CREATE FUNCTION public.eut_account_operational() RETURNS boolean
  LANGUAGE sql STABLE AS $f$
  SELECT coalesce((SELECT operational FROM public.test_account_operational WHERE user_id=auth.uid()),false);
$f$;
CREATE TABLE eut_migration.project_owner_bootstrap (
  singleton boolean PRIMARY KEY, owner_email text NOT NULL,
  claimed_user_id uuid REFERENCES auth.users(id), claimed_at timestamptz
);

INSERT INTO auth.users VALUES
 ('11111111-1111-4111-8111-111111111111','owner@example.invalid',now()),
 ('22222222-2222-4222-8222-222222222222','manager@example.invalid',now()),
 ('33333333-3333-4333-8333-333333333333','stranger@example.invalid',now());
INSERT INTO auth.sessions VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333');
INSERT INTO public.user_roles VALUES
 ('11111111-1111-4111-8111-111111111111','admin'),
 ('22222222-2222-4222-8222-222222222222','admin');
INSERT INTO public.test_account_operational VALUES
 ('11111111-1111-4111-8111-111111111111',true),
 ('22222222-2222-4222-8222-222222222222',true),
 ('33333333-3333-4333-8333-333333333333',true);
INSERT INTO eut_migration.project_owner_bootstrap VALUES
 (true,'owner@example.invalid','11111111-1111-4111-8111-111111111111',now());

\ir ../eut-owner-directory-display-20261120.sql

-- Gate 1: anonymous public read exposes strictly the eight harmless flags.
SET ROLE anon;
DO $test$
DECLARE v_settings jsonb := public.eut_public_directory_settings();
BEGIN
 IF jsonb_typeof(v_settings) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(v_settings)) <> 8
   OR v_settings->>'auto_region' <> 'true' OR v_settings ? 'updated_by' THEN
   RAISE EXCEPTION 'Anonymous read leaked owner metadata or has wrong defaults';
 END IF;
END;
$test$;
-- Gate 2: anonymous cannot read or mutate private tables, nor call owner RPC.
DO $test$
BEGIN
 BEGIN
   PERFORM count(*) FROM eut_migration.directory_display_settings;
   RAISE EXCEPTION 'anonymous private table access unexpectedly allowed';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
 BEGIN
   PERFORM public.eut_owner_directory_settings();
   RAISE EXCEPTION 'anonymous owner read unexpectedly allowed';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
 BEGIN
   PERFORM public.eut_owner_update_directory_settings(public.eut_public_directory_settings(),1,'Teste de acesso negado');
   RAISE EXCEPTION 'anonymous owner update unexpectedly allowed';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END;
$test$;
RESET ROLE;

SET ROLE authenticated;
-- Gate 3: a second administrator cannot act as owner.
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',false);
DO $test$
BEGIN
 BEGIN
   PERFORM public.eut_owner_directory_settings();
   RAISE EXCEPTION 'manager was authorized as the unique owner';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
 BEGIN
   PERFORM public.eut_owner_update_directory_settings(public.eut_public_directory_settings(),1,'Manager nao pode salvar');
   RAISE EXCEPTION 'manager was authorized to mutate';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END;
$test$;

-- Gate 4: forged or missing auth.sessions row is rejected.
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","session_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}',false);
DO $test$
BEGIN
 BEGIN
   PERFORM public.eut_owner_directory_settings();
   RAISE EXCEPTION 'forged session was accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END;
$test$;

-- Gates 5–7: legitimate owner reads, writes, rereads, audits.
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',false);
DO $test$
DECLARE
 v_before jsonb := public.eut_owner_directory_settings();
 v_new jsonb := jsonb_set(public.eut_public_directory_settings(),'{online_outline}','false');
 v_saved jsonb;
 v_after jsonb;
BEGIN
 IF (v_before->>'version')::integer <> 1 THEN RAISE EXCEPTION 'Wrong initial version'; END IF;
 v_saved := public.eut_owner_update_directory_settings(v_new,1,'Ajuste visual sintetico');
 v_after := public.eut_owner_directory_settings();
 IF (v_saved->>'version')::integer <> 2 OR (v_after->>'version')::integer <> 2
   OR (v_after->'settings'->>'online_outline') <> 'false'
   OR jsonb_array_length(v_after->'audit') <> 1 THEN
   RAISE EXCEPTION 'Owner save, reread or audit was not persisted';
 END IF;
 IF v_after->'audit'->0->>'reason' <> 'Ajuste visual sintetico' THEN
   RAISE EXCEPTION 'Audit justification mismatch';
 END IF;
END;
$test$;

-- Gate 8: stale CAS never overwrites newer settings.
DO $test$
BEGIN
 BEGIN
   PERFORM public.eut_owner_update_directory_settings(public.eut_public_directory_settings(),1,'Versao antiga bloqueada');
   RAISE EXCEPTION 'stale owner update succeeded';
 EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
 END;
END;
$test$;
-- Gate 9: idempotent same-value writes do not create phantom audit.
DO $test$
DECLARE v_result jsonb;
BEGIN
 v_result := public.eut_owner_update_directory_settings(public.eut_public_directory_settings(),2,'Salvar valor identico');
 IF (v_result->>'version')::integer <> 2 OR
   jsonb_array_length(public.eut_owner_directory_settings()->'audit') <> 1 THEN
   RAISE EXCEPTION 'No-op unexpectedly advanced version or audit';
 END IF;
END;
$test$;
-- Gates 10–12: unexpected keys, invalid types and no reason are rejected.
DO $test$
BEGIN
 BEGIN
   PERFORM public.eut_owner_update_directory_settings(public.eut_public_directory_settings() || '{"phone":"private"}'::jsonb,2,'Campo nao permitido');
   RAISE EXCEPTION 'Unexpected key accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
 END;
 BEGIN
   PERFORM public.eut_owner_update_directory_settings(jsonb_set(public.eut_public_directory_settings(),'{online_outline}','"yes"'),2,'Tipo incorreto bloqueado');
   RAISE EXCEPTION 'String instead of boolean accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
 END;
 BEGIN
   PERFORM public.eut_owner_update_directory_settings(public.eut_public_directory_settings(),2,'curto');
   RAISE EXCEPTION 'Short audit reason accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
 END;
END;
$test$;
RESET ROLE;

-- Gates 13–14: loss of operational status or owner bootstrap denies mutation.
UPDATE public.test_account_operational SET operational=false
  WHERE user_id='11111111-1111-4111-8111-111111111111';
SET ROLE authenticated;
DO $test$
BEGIN
 BEGIN
   PERFORM public.eut_owner_update_directory_settings(public.eut_public_directory_settings(),2,'Conta suspensa bloqueada');
   RAISE EXCEPTION 'Suspended owner could still mutate';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END;
$test$;
RESET ROLE;
UPDATE public.test_account_operational SET operational=true;
UPDATE eut_migration.project_owner_bootstrap SET claimed_user_id=NULL,claimed_at=NULL;
SET ROLE authenticated;
DO $test$
BEGIN
 BEGIN
   PERFORM public.eut_owner_update_directory_settings(public.eut_public_directory_settings(),2,'Bootstrap nao atribuido');
   RAISE EXCEPTION 'Unclaimed bootstrap could mutate';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END;
$test$;
RESET ROLE;

-- Gate 15: only synthetic settings changed; exactly one append-only audit event.
DO $test$
BEGIN
 IF (SELECT version FROM eut_migration.directory_display_settings WHERE singleton) <> 2
   OR (SELECT count(*) FROM eut_migration.directory_display_audit) <> 1 THEN
   RAISE EXCEPTION 'Unexpected writes after negative tests';
 END IF;
END;
$test$;
SELECT 'PASS 15 isolated owner/settings/RLS/audit gates' AS outcome;
