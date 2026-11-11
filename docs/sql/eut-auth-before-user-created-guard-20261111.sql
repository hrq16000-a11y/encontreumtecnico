-- Preparação SOMENTE: não ativar o hook em produção sem homologação.
-- Projeto Supabase: pqtzhctvjbfcunmrvxne / Encontre um Técnico Admin.
-- Before User Created (Postgres): eut_moderation.before_user_created_guard
-- Não edita auth.users, não exclui nem insere dados, não altera a fonte WordPress.
BEGIN;

CREATE OR REPLACE FUNCTION eut_moderation.before_user_created_guard(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $guard$
DECLARE
  v_email text := lower(btrim(coalesce(event->'user'->>'email', '')));
  v_phone text := regexp_replace(coalesce(event->'user'->>'phone', ''), '[^0-9]', '', 'g');
  v_restricted boolean := false;
BEGIN
  IF jsonb_typeof(event->'user') IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message', 'Não foi possível concluir seu cadastro. Consulte o suporte.'
    ));
  END IF;

  -- Somente identificadores fornecidos pelo próprio provedor Auth.
  -- Nunca confiar em user_metadata, formulário, nome, bairro, IP ou DDD
  -- como prova de que se trata da mesma pessoa.
  IF v_email <> '' THEN
    SELECT EXISTS (
      SELECT 1
        FROM eut_moderation.blocked_accounts AS b
        JOIN auth.users AS u ON u.id = b.user_id
       WHERE lower(btrim(coalesce(u.email, ''))) = v_email
    ) INTO v_restricted;
  END IF;

  -- Número completo: sem correspondências apenas por DDD ou sufixo.
  -- O campo user.phone pode não vir preenchido no OAuth Google.
  IF NOT v_restricted AND length(v_phone) BETWEEN 10 AND 15 THEN
    SELECT EXISTS (
      SELECT 1 FROM eut_moderation.blocked_phones AS b
       WHERE b.phone_digits = v_phone
    ) OR EXISTS (
      SELECT 1 FROM eut_moderation.blocked_accounts AS b
      JOIN auth.users AS u ON u.id = b.user_id
      WHERE regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g') = v_phone
    ) INTO v_restricted;
  END IF;

  IF v_restricted THEN
    RETURN jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Não foi possível concluir seu cadastro. Consulte o suporte.'
    ));
  END IF;

  RETURN '{}'::jsonb;
END;
$guard$;

-- Função em schema privado; só o serviço de autenticação pode executá-la.
REVOKE ALL ON FUNCTION eut_moderation.before_user_created_guard(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA eut_moderation TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION eut_moderation.before_user_created_guard(jsonb)
  TO supabase_auth_admin;

DO $assert$
BEGIN
  IF has_function_privilege('anon',
       'eut_moderation.before_user_created_guard(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'eut_moderation.before_user_created_guard(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('supabase_auth_admin',
       'eut_moderation.before_user_created_guard(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Permissões inseguras do hook de pré-cadastro';
  END IF;
END;
$assert$;
COMMIT;

-- Ativação é separada (Supabase Dashboard > Authentication > Hooks):
-- Before User Created => Postgres => eut_moderation.before_user_created_guard.
-- NÃO habilitar até teste de email, Google OAuth, telefone, recuperação e rollback.
-- Limitação: não identifica uma pessoa que use e-mail E telefone diferentes.
-- A proteção de contas existentes continua nas RLS/RPCs/triggers da PR #138.
