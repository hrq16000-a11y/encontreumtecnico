-- EUT · Rodada 2/5: sessão válida e conta não restrita para operações sensíveis.
-- Preparação para homologação: NÃO aplicar na produção sem E2E de sessões reais.
-- Reutiliza banimentos da PR #138; não remove, edita ou faz logout de auth.users.
BEGIN;

-- Checagem privada por IDENTIDADE já confirmada, sem confiar em user_metadata/IP/DDD.
CREATE OR REPLACE FUNCTION eut_moderation.subject_operational(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path='pg_catalog' AS $$
  SELECT _user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM eut_moderation.blocked_accounts b WHERE b.user_id=_user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.eut_technician_private_contacts c
      JOIN eut_moderation.blocked_phones b
        ON b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
      WHERE c.user_id=_user_id
    );
$$;
REVOKE ALL ON FUNCTION eut_moderation.subject_operational(uuid)
  FROM PUBLIC,anon,authenticated;

-- JWT válido NÃO significa sessão ainda vigente após logout/revogação.
-- GoTrue emite session_id; teste de existência verifica servidor, nunca só claims editáveis.
CREATE OR REPLACE FUNCTION public.eut_sensitive_session_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path='pg_catalog' AS $$
 SELECT auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM auth.sessions s
    WHERE s.user_id=auth.uid()
      AND s.id::text=coalesce(auth.jwt()->>'session_id','')
  )
  AND eut_moderation.subject_operational(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.eut_sensitive_session_active()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_sensitive_session_active()
  TO authenticated;

-- RLS é obrigatório para acesso direto via API. Nenhuma política permissiva nova.
DROP POLICY IF EXISTS eut_session_private_requests ON public.service_requests;
CREATE POLICY eut_session_private_requests ON public.service_requests
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT public.eut_sensitive_session_active()));

DROP POLICY IF EXISTS eut_session_direct_consents ON public.eut_direct_request_consents;
CREATE POLICY eut_session_direct_consents ON public.eut_direct_request_consents
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT public.eut_sensitive_session_active()));

DROP POLICY IF EXISTS eut_session_legacy_claims_read ON public.legacy_profile_claims;
CREATE POLICY eut_session_legacy_claims_read ON public.legacy_profile_claims
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT public.eut_sensitive_session_active()));

DROP POLICY IF EXISTS eut_session_legacy_claims_create ON public.legacy_profile_claims;
CREATE POLICY eut_session_legacy_claims_create ON public.legacy_profile_claims
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.eut_sensitive_session_active()));

DROP POLICY IF EXISTS eut_session_technician_updates ON public.technicians;
CREATE POLICY eut_session_technician_updates ON public.technicians
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT public.eut_sensitive_session_active()))
  WITH CHECK ((SELECT public.eut_sensitive_session_active()));

-- Essas RPCs são SECURITY DEFINER e ignoram RLS: proteger TAMBÉM seus inserts/updates
-- no destino. Um admin legítimo continua podendo moderar técnico banido, pois o
-- estado da sessão do ATOR é validado; não o status do alvo no caso de technicians.
CREATE OR REPLACE FUNCTION eut_moderation.guard_sensitive_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path='pg_catalog' AS $$
DECLARE v_user uuid := auth.uid(); v_subject uuid;
BEGIN
  -- Rotinas de manutenção internas sem JWT continuam disponíveis.
  -- RPCs públicas afetadas já exigem auth.uid() válido antes do INSERT/UPDATE.
  IF v_user IS NOT NULL AND NOT public.eut_sensitive_session_active() THEN
    -- Permite DESLIGAR presença, sem permitir que conta restrita fique online.
    IF TG_TABLE_NAME='eut_technician_presence'
       AND NEW.available IS FALSE THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Sua conta não pode executar esta operação. Consulte o suporte.'
      USING ERRCODE='42501';
  END IF;

  IF TG_TABLE_NAME='eut_direct_request_replies' THEN
    v_subject := NEW.technician_user_id;
    IF NOT eut_moderation.subject_operational(v_subject) THEN
      RAISE EXCEPTION 'Solicitação indisponível. Consulte o suporte.'
        USING ERRCODE='42501';
    END IF;
  ELSIF TG_TABLE_NAME='eut_technician_presence' THEN
    IF NEW.available IS TRUE
       AND NOT eut_moderation.subject_operational(NEW.user_id) THEN
      RAISE EXCEPTION 'Presença indisponível. Consulte o suporte.'
        USING ERRCODE='42501';
    END IF;
  ELSIF TG_TABLE_NAME='eut_direct_request_consents' THEN
    SELECT t.user_id INTO v_subject FROM public.technicians t
     WHERE t.id=NEW.technician_id;
    IF NOT eut_moderation.subject_operational(NEW.client_id)
       OR NOT eut_moderation.subject_operational(v_subject) THEN
      RAISE EXCEPTION 'O compartilhamento está indisponível. Consulte o suporte.'
        USING ERRCODE='42501';
    END IF;
  ELSIF TG_TABLE_NAME='eut_technician_referrals' THEN
    IF NOT eut_moderation.subject_operational(NEW.inviter_user_id)
       OR NOT eut_moderation.subject_operational(NEW.invited_user_id) THEN
      RAISE EXCEPTION 'Indicação indisponível. Consulte o suporte.'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION eut_moderation.guard_sensitive_write()
 FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS eut_active_session_tech_write ON public.technicians;
CREATE TRIGGER eut_active_session_tech_write
 BEFORE INSERT OR UPDATE ON public.technicians
 FOR EACH ROW EXECUTE FUNCTION eut_moderation.guard_sensitive_write();

DROP TRIGGER IF EXISTS eut_active_session_presence ON public.eut_technician_presence;
CREATE TRIGGER eut_active_session_presence
 BEFORE INSERT OR UPDATE ON public.eut_technician_presence
 FOR EACH ROW EXECUTE FUNCTION eut_moderation.guard_sensitive_write();

DROP TRIGGER IF EXISTS eut_active_session_reply ON public.eut_direct_request_replies;
CREATE TRIGGER eut_active_session_reply
 BEFORE INSERT ON public.eut_direct_request_replies
 FOR EACH ROW EXECUTE FUNCTION eut_moderation.guard_sensitive_write();

DROP TRIGGER IF EXISTS eut_active_session_sharing ON public.eut_direct_request_consents;
CREATE TRIGGER eut_active_session_sharing
 BEFORE INSERT ON public.eut_direct_request_consents
 FOR EACH ROW EXECUTE FUNCTION eut_moderation.guard_sensitive_write();

DROP TRIGGER IF EXISTS eut_active_session_referral ON public.eut_technician_referrals;
CREATE TRIGGER eut_active_session_referral
 BEFORE INSERT ON public.eut_technician_referrals
 FOR EACH ROW EXECUTE FUNCTION eut_moderation.guard_sensitive_write();

DO $check$
BEGIN
  IF has_function_privilege('anon','public.eut_sensitive_session_active()','EXECUTE')
  OR has_function_privilege('authenticated','eut_moderation.subject_operational(uuid)','EXECUTE')
  OR has_function_privilege('authenticated','eut_moderation.guard_sensitive_write()','EXECUTE')
  THEN RAISE EXCEPTION 'Operações sensíveis expostas ao público'; END IF;
END
$check$;
COMMIT;

-- IMPORTANTE: este patch NÃO revoga sessões do Supabase Auth ou do Google.
-- Token JWT antigo pode continuar válido noutras APIs que não usem as proteções acima.
-- A etapa de revogação do refresh token requer fluxo admin/server separado,
-- com autorização, auditoria e testes reais; não manipular auth.sessions manualmente.
