-- Pré-cadastro nativo privado EUT. Nenhum dado pessoal neste arquivo.
-- Reimportação idempotente, sem ativar perfis e sem vincular por número isolado.
CREATE SCHEMA IF NOT EXISTS eut_pioneers;
REVOKE ALL ON SCHEMA eut_pioneers FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION eut_pioneers.normalize_br_phone(_raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'pg_catalog'
AS $$
DECLARE d text;
BEGIN
 d:=regexp_replace(coalesce(_raw,''),'[^0-9]','','g');
 IF length(d) IN (12,13) AND left(d,2)='55' THEN d:=substr(d,3); END IF;
 IF length(d) NOT IN (10,11) OR left(d,2)!~'^[1-9][0-9]$' OR substr(d,3)~'^0+$'
 THEN RETURN NULL; END IF;
 RETURN '+55'||d;
END
$$;
REVOKE ALL ON FUNCTION eut_pioneers.normalize_br_phone(text) FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS eut_pioneers.pre_registrations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 origin text NOT NULL CHECK(origin IN ('wordpress_account','wordpress_profile','community_contact')),
 source_id text NOT NULL CHECK(length(source_id) BETWEEN 1 AND 180),
 person_kind text NOT NULL DEFAULT 'indefinido' CHECK(person_kind IN ('tecnico','cliente','indefinido')),
 source_user_id bigint,
 source_post_id bigint,
 display_name_hint text,
 email_hint text,
 phone_e164 text CHECK(phone_e164 IS NULL OR phone_e164~'^\+55[1-9][0-9][0-9]{8,9}$'),
 origin_note text,
 claim_state text NOT NULL DEFAULT 'pre_cadastro' CHECK(claim_state IN ('pre_cadastro','revisao','vinculado')),
 linked_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 verified_at timestamptz,
 bronze_eligible boolean NOT NULL DEFAULT false,
 imported_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT eut_pioneer_unique_source UNIQUE(origin,source_id),
 CONSTRAINT eut_pioneer_verified_state CHECK(claim_state <> 'vinculado' OR (linked_auth_user_id IS NOT NULL AND verified_at IS NOT NULL))
);
ALTER TABLE eut_pioneers.pre_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_pioneers.pre_registrations FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS eut_pioneer_phone_idx ON eut_pioneers.pre_registrations(phone_e164) WHERE phone_e164 IS NOT NULL AND claim_state <> 'vinculado';
CREATE INDEX IF NOT EXISTS eut_pioneer_email_idx ON eut_pioneers.pre_registrations(lower(email_hint)) WHERE email_hint IS NOT NULL AND claim_state <> 'vinculado';
CREATE INDEX IF NOT EXISTS eut_pioneer_link_idx ON eut_pioneers.pre_registrations(linked_auth_user_id) WHERE linked_auth_user_id IS NOT NULL;
COMMENT ON TABLE eut_pioneers.pre_registrations IS 'Arquivo privado independente da hospedagem WordPress: dados de origem nao validam titularidade, autorizacao de contato ou categoria profissional.';
INSERT INTO eut_pioneers.pre_registrations (origin,source_id,person_kind,source_user_id,display_name_hint,email_hint,origin_note)
SELECT 'wordpress_account',a.source_key||':'||a.wp_user_id::text,
 CASE WHEN q.intended_type IN ('tecnico','cliente') THEN q.intended_type ELSE 'indefinido' END,
 a.wp_user_id,a.display_name,lower(nullif(btrim(a.wp_email),'')),
 'Conta antiga: conferir identidade e escolher categorias atuais'
FROM eut_migration.legacy_accounts a
LEFT JOIN eut_migration.account_activation_queue q ON q.source_key=a.source_key AND q.wp_user_id=a.wp_user_id
ON CONFLICT(origin,source_id) DO NOTHING;
INSERT INTO eut_pioneers.pre_registrations (origin,source_id,person_kind,source_user_id,source_post_id,display_name_hint,email_hint,phone_e164,origin_note)
SELECT 'wordpress_profile',d.source_key||':'||d.wp_post_id::text,
 CASE WHEN d.kind='candidate' THEN 'tecnico' WHEN d.kind='employer' THEN 'cliente' ELSE 'indefinido' END,
 d.wp_user_id,d.wp_post_id,d.title,lower(nullif(btrim(d.contact_email),'')),
 eut_pioneers.normalize_br_phone(d.contact_phone),
 'Perfil antigo: sem publicacao, telefone e categorizacao exigem confirmacao'
FROM eut_migration.legacy_directory d
ON CONFLICT(origin,source_id) DO NOTHING;
-- Contatos da comunidade serão importados separadamente do CSV privado (nunca no repositório).
