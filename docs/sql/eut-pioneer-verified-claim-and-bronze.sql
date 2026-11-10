-- Pioneiro Bronze: reconhecimento apenas após identidade verificada.
-- Phone match é aceito APENAS se auth.users.phone_confirmed_at for real e não houver conflito.
-- Perfis WordPress não são reivindicados exclusivamente por coincidência de telefone.
CREATE TABLE IF NOT EXISTS eut_pioneers.claim_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 pre_registration_id uuid NOT NULL REFERENCES eut_pioneers.pre_registrations(id),
 actor_user_id uuid NOT NULL REFERENCES auth.users(id),
 proof text NOT NULL CHECK(proof IN ('email_verificado','telefone_otp_verificado')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (pre_registration_id,actor_user_id,proof)
);
ALTER TABLE eut_pioneers.claim_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE eut_pioneers.claim_audit FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.eut_pioneer_badges (
 technician_id uuid PRIMARY KEY REFERENCES public.technicians(id) ON DELETE CASCADE,
 tier text NOT NULL DEFAULT 'bronze' CHECK(tier='bronze'),
 recognized_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.eut_pioneer_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.eut_pioneer_badges FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.eut_pioneer_badges TO anon,authenticated;
DROP POLICY IF EXISTS eut_pioneer_badges_published_only ON public.eut_pioneer_badges;
CREATE POLICY eut_pioneer_badges_published_only
 ON public.eut_pioneer_badges FOR SELECT TO anon,authenticated
 USING (EXISTS(SELECT 1 FROM public.technicians t WHERE t.id=technician_id AND t.status='aprovado'::public.approval_status));
COMMENT ON TABLE public.eut_pioneer_badges IS 'Somente ID de técnico aprovado e tier bronze. Nenhum email, número, identificador ou documento histórico público.';

CREATE OR REPLACE FUNCTION public.eut_claim_my_pioneer_pre_registration()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE
 v_uid uuid:=auth.uid();
 v_email text;
 v_phone text;
 v_role text;
 v_account_count int;
 v_wp_user bigint;
 v_account_kind text;
 v_prior_link uuid;
 v_group_count int;
 v_foreign_profile_count int;
 v_count int:=0;
 v_has_bronze boolean:=false;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'authenticated session required'; END IF;
 SELECT lower(btrim(u.email)),
   CASE WHEN u.phone_confirmed_at IS NOT NULL THEN eut_pioneers.normalize_br_phone(u.phone) ELSE NULL END
 INTO v_email,v_phone
 FROM auth.users u
 WHERE u.id=v_uid AND u.email_confirmed_at IS NOT NULL
   AND EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id=u.id
     AND i.provider IN ('google','email')
     AND lower(btrim(coalesce(i.identity_data->>'email','')))=lower(btrim(u.email))
     AND (i.provider<>'google' OR coalesce(i.identity_data->>'email_verified','true')<>'false'));
 IF v_email IS NULL THEN RAISE EXCEPTION 'verified email identity required'; END IF;
 SELECT r.role::text INTO v_role FROM public.user_roles r
 WHERE r.user_id=v_uid AND r.role IN ('tecnico'::public.app_role,'cliente'::public.app_role) LIMIT 1;
 IF v_role IS NULL THEN RETURN jsonb_build_object('state','tipo_conta_pendente','linked',0); END IF;
 IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=v_uid AND r.role::text<>v_role)
 THEN RAISE EXCEPTION 'conflicting account role'; END IF;

 -- Correlação de EMAIL verificado com uma única conta histórica:
 SELECT count(*),max(source_user_id) INTO v_account_count,v_wp_user
 FROM eut_pioneers.pre_registrations
 WHERE origin='wordpress_account' AND email_hint=v_email;
 IF v_account_count>1 THEN RETURN jsonb_build_object('state','revisao_necessaria','linked',0); END IF;
 IF v_account_count=1 THEN
   SELECT person_kind, linked_auth_user_id INTO v_account_kind,v_prior_link
   FROM eut_pioneers.pre_registrations
   WHERE origin='wordpress_account' AND email_hint=v_email
   FOR UPDATE;
   IF v_account_kind<>v_role OR (v_prior_link IS NOT NULL AND v_prior_link<>v_uid)
   THEN RETURN jsonb_build_object('state','revisao_necessaria','linked',0); END IF;

   UPDATE eut_pioneers.pre_registrations
   SET claim_state='vinculado',linked_auth_user_id=v_uid,
       verified_at=coalesce(verified_at,now()),
       bronze_eligible=(v_role='tecnico'),updated_at=now()
   WHERE origin='wordpress_account' AND email_hint=v_email
     AND (linked_auth_user_id IS NULL OR linked_auth_user_id=v_uid);
   GET DIAGNOSTICS v_count=ROW_COUNT;

   -- A mesma autoria antiga pode possuir vários perfis, mas demos e fichas
   -- excluídas continuam fora de reconhecimento/catálogo.
   UPDATE eut_pioneers.pre_registrations p
   SET claim_state='vinculado',linked_auth_user_id=v_uid,
       verified_at=coalesce(p.verified_at,now()),
       bronze_eligible=false,updated_at=now()
   FROM eut_migration.legacy_directory d
   LEFT JOIN public.legacy_review_profiles review
     ON review.source_key=d.source_key AND review.wp_post_id=d.wp_post_id
   LEFT JOIN public.eut_legacy_profile_management management
     ON management.source_key=d.source_key AND management.wp_post_id=d.wp_post_id
   WHERE p.origin='wordpress_profile' AND p.source_user_id=v_wp_user
     AND p.source_post_id=d.wp_post_id AND p.person_kind=v_role
     AND (p.linked_auth_user_id IS NULL OR p.linked_auth_user_id=v_uid)
     AND d.source_status='publish' AND d.source_approved=true
     AND coalesce(review.demo_candidate,false)=false
     AND coalesce(management.record_state,'pendente')<>'excluido';
   -- Não publica nada. Auditoria por ID privado:
   INSERT INTO eut_pioneers.claim_audit(pre_registration_id,actor_user_id,proof)
   SELECT id,v_uid,'email_verificado'
   FROM eut_pioneers.pre_registrations
   WHERE linked_auth_user_id=v_uid AND origin IN ('wordpress_account','wordpress_profile')
   ON CONFLICT DO NOTHING;
 END IF;

 -- Associação de contatos de grupos exige OTP real e ausência de colisões com
 -- perfis WordPress de outra autoria; telefones digitados NÃO concedem acesso.
 IF v_phone IS NOT NULL THEN
   SELECT count(*) INTO v_group_count FROM eut_pioneers.pre_registrations
   WHERE origin='community_contact' AND phone_e164=v_phone;
   SELECT count(*) INTO v_foreign_profile_count FROM eut_pioneers.pre_registrations
   WHERE origin='wordpress_profile' AND phone_e164=v_phone
     AND (linked_auth_user_id IS NULL OR linked_auth_user_id<>v_uid);
   IF v_group_count=1 AND v_foreign_profile_count=0 THEN
     UPDATE eut_pioneers.pre_registrations
     SET claim_state='vinculado',linked_auth_user_id=v_uid,
         verified_at=coalesce(verified_at,now()),bronze_eligible=(v_role='tecnico'),updated_at=now()
     WHERE origin='community_contact' AND phone_e164=v_phone
       AND (linked_auth_user_id IS NULL OR linked_auth_user_id=v_uid);
     INSERT INTO eut_pioneers.claim_audit(pre_registration_id,actor_user_id,proof)
     SELECT id,v_uid,'telefone_otp_verificado'
     FROM eut_pioneers.pre_registrations
     WHERE origin='community_contact' AND linked_auth_user_id=v_uid AND phone_e164=v_phone
     ON CONFLICT DO NOTHING;
   END IF;
 END IF;

 -- Selo somente para profissional publicado + registro realmente vinculado.
 INSERT INTO public.eut_pioneer_badges(technician_id)
 SELECT t.id FROM public.technicians t WHERE t.user_id=v_uid
   AND t.status='aprovado'::public.approval_status
   AND EXISTS (SELECT 1 FROM eut_pioneers.pre_registrations p
               WHERE p.linked_auth_user_id=v_uid AND p.claim_state='vinculado'
                 AND p.verified_at IS NOT NULL AND p.bronze_eligible)
 ON CONFLICT DO NOTHING;
 SELECT count(*) INTO v_count FROM eut_pioneers.pre_registrations
 WHERE linked_auth_user_id=v_uid AND claim_state='vinculado';
 SELECT EXISTS(SELECT 1 FROM eut_pioneers.pre_registrations
              WHERE linked_auth_user_id=v_uid AND bronze_eligible AND claim_state='vinculado')
 INTO v_has_bronze;
 RETURN jsonb_build_object('state',CASE WHEN v_count>0 THEN 'vinculado' ELSE 'pre_cadastro_nao_identificado' END,
   'linked',v_count,'bronze_eligible',v_has_bronze);
END
$$;
REVOKE ALL ON FUNCTION public.eut_claim_my_pioneer_pre_registration() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eut_claim_my_pioneer_pre_registration() TO authenticated;

CREATE OR REPLACE FUNCTION eut_pioneers.award_bronze_after_publish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $$
BEGIN
 IF NEW.status='aprovado'::public.approval_status AND EXISTS(
  SELECT 1 FROM eut_pioneers.pre_registrations p WHERE p.linked_auth_user_id=NEW.user_id
   AND p.claim_state='vinculado' AND p.verified_at IS NOT NULL AND p.bronze_eligible
 ) THEN
  INSERT INTO public.eut_pioneer_badges(technician_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION eut_pioneers.award_bronze_after_publish() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS eut_pioneer_bronze_publish ON public.technicians;
CREATE TRIGGER eut_pioneer_bronze_publish AFTER INSERT OR UPDATE OF status ON public.technicians
FOR EACH ROW EXECUTE FUNCTION eut_pioneers.award_bronze_after_publish();
