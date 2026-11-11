-- EUT / Administração auditável de perfis reais e fichas históricas.
-- All changes are explicit actions by a verified administrator. No bulk delete, public activation
-- or change to imported identities. Idempotent. Keep original WP data and 20 demo records.
BEGIN;
GRANT UPDATE ON public.eut_legacy_profile_management TO authenticated;

CREATE TABLE IF NOT EXISTS public.eut_admin_management_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('technician','legacy_review')),
  target_key text NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eut_admin_management_log_recent
  ON public.eut_admin_management_log (created_at DESC);
ALTER TABLE public.eut_admin_management_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eut_admin_management_log_read ON public.eut_admin_management_log;
CREATE POLICY eut_admin_management_log_read ON public.eut_admin_management_log
 FOR SELECT TO authenticated
 USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'admin'::public.app_role));
REVOKE ALL ON TABLE public.eut_admin_management_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.eut_admin_management_log TO authenticated;
-- No client may INSERT, UPDATE or DELETE audit events, including a signed-in administrator.

CREATE OR REPLACE FUNCTION eut_moderation.eut_audit_admin_technician()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE reason text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RETURN NEW; END IF;
 IF (OLD.status,OLD.display_name,OLD.bio,OLD.region)
    IS NOT DISTINCT FROM (NEW.status,NEW.display_name,NEW.bio,NEW.region) THEN RETURN NEW; END IF;
 reason:=COALESCE(NULLIF(btrim(current_setting('eut.admin_reason',true)),''),'Alteração administrativa sem motivo registrado');
 INSERT INTO public.eut_admin_management_log(actor_id,target_type,target_key,action,reason,before_state,after_state)
 VALUES(auth.uid(),'technician',NEW.id::text,'technician_update',left(reason,400),
        jsonb_build_object('status',OLD.status::text,'name_changed',OLD.display_name IS DISTINCT FROM NEW.display_name),
        jsonb_build_object('status',NEW.status::text,'name_changed',OLD.display_name IS DISTINCT FROM NEW.display_name,
                           'bio_changed',OLD.bio IS DISTINCT FROM NEW.bio,'region_changed',OLD.region IS DISTINCT FROM NEW.region));
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS eut_admin_audit_technician ON public.technicians;
CREATE TRIGGER eut_admin_audit_technician AFTER UPDATE OF status,display_name,bio,region
ON public.technicians FOR EACH ROW EXECUTE FUNCTION eut_moderation.eut_audit_admin_technician();

CREATE OR REPLACE FUNCTION eut_moderation.eut_audit_admin_legacy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE reason text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND
  (OLD.record_state,OLD.corrected_name,OLD.admin_notes) IS NOT DISTINCT FROM
  (NEW.record_state,NEW.corrected_name,NEW.admin_notes) THEN RETURN NEW; END IF;
 reason:=COALESCE(NULLIF(btrim(current_setting('eut.admin_reason',true)),''),'Revisão administrativa sem motivo registrado');
 INSERT INTO public.eut_admin_management_log(actor_id,target_type,target_key,action,reason,before_state,after_state)
 VALUES(auth.uid(),'legacy_review',NEW.source_key||':'||NEW.wp_post_id::text,
       CASE WHEN TG_OP='INSERT' THEN 'legacy_create_review' ELSE 'legacy_update_review' END,left(reason,400),
       CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE jsonb_build_object('state',OLD.record_state) END,
       jsonb_build_object('state',NEW.record_state,'name_corrected',NEW.corrected_name IS NOT NULL,'notes_updated',true));
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS eut_admin_audit_legacy_management ON public.eut_legacy_profile_management;
CREATE TRIGGER eut_admin_audit_legacy_management AFTER INSERT OR UPDATE OF record_state,corrected_name,admin_notes
ON public.eut_legacy_profile_management FOR EACH ROW EXECUTE FUNCTION eut_moderation.eut_audit_admin_legacy();

CREATE OR REPLACE FUNCTION public.eut_admin_technician_action(
 p_id uuid,p_action text,p_value jsonb,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE row_before public.technicians%ROWTYPE; row_after public.technicians%ROWTYPE;
  reason text:=btrim(coalesce(p_reason,'')); new_name text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso administrativo necessário' USING ERRCODE='42501'; END IF;
 IF char_length(reason)<8 OR char_length(reason)>400 THEN
  RAISE EXCEPTION 'Informe o motivo da alteração (8 a 400 caracteres)' USING ERRCODE='22023'; END IF;
 SELECT * INTO row_before FROM public.technicians WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado ou sem permissão' USING ERRCODE='P0002'; END IF;
 PERFORM set_config('eut.admin_reason',reason,true);
 IF p_action='suspender' THEN
  UPDATE public.technicians SET status='suspenso',reviewed_at=now() WHERE id=p_id RETURNING * INTO row_after;
 ELSIF p_action IN ('reativar','aprovar') THEN
  UPDATE public.technicians SET status='aprovado',reviewed_at=now() WHERE id=p_id RETURNING * INTO row_after;
 ELSIF p_action='rejeitar' THEN
  UPDATE public.technicians SET status='rejeitado',reviewed_at=now() WHERE id=p_id RETURNING * INTO row_after;
 ELSIF p_action='revisar' THEN
  UPDATE public.technicians SET status='pendente',reviewed_at=now() WHERE id=p_id RETURNING * INTO row_after;
 ELSIF p_action='editar' THEN
  new_name:=btrim(coalesce(p_value->>'display_name',row_before.display_name));
  IF char_length(new_name)<3 OR char_length(new_name)>80 THEN
   RAISE EXCEPTION 'Nome precisa ter de 3 a 80 caracteres' USING ERRCODE='22023'; END IF;
  IF char_length(coalesce(p_value->>'bio',row_before.bio,''))>1500 OR
     char_length(coalesce(p_value->>'region',row_before.region,''))>100 THEN
    RAISE EXCEPTION 'Resumo ou região excede o limite' USING ERRCODE='22023'; END IF;
  UPDATE public.technicians
    SET display_name=new_name,
        bio=CASE WHEN p_value ? 'bio' THEN NULLIF(btrim(p_value->>'bio'),'') ELSE bio END,
        region=CASE WHEN p_value ? 'region' THEN NULLIF(btrim(p_value->>'region'),'') ELSE region END
    WHERE id=p_id RETURNING * INTO row_after;
 ELSE RAISE EXCEPTION 'Ação administrativa desconhecida' USING ERRCODE='22023'; END IF;
 IF row_after.id IS NULL THEN RAISE EXCEPTION 'Alteração não foi gravada' USING ERRCODE='P0002'; END IF;
 RETURN jsonb_build_object('id',row_after.id,'status',row_after.status,'name',row_after.display_name);
END; $$;
REVOKE ALL ON FUNCTION public.eut_admin_technician_action(uuid,text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.eut_admin_technician_action(uuid,text,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.eut_admin_legacy_action(
 p_ids bigint[], p_action text, p_value text, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE admin_id uuid:=auth.uid(); reason text:=btrim(coalesce(p_reason,''));
        count_items integer; count_found integer; profile record; saved public.eut_legacy_profile_management%ROWTYPE;
        new_state text; clean_value text:=btrim(coalesce(p_value,''));
BEGIN
 IF admin_id IS NULL OR NOT public.has_role(admin_id,'admin'::public.app_role) THEN
  RAISE EXCEPTION 'Acesso administrativo necessário' USING ERRCODE='42501'; END IF;
 IF char_length(reason)<8 OR char_length(reason)>400 THEN
  RAISE EXCEPTION 'Informe o motivo da alteração (8 a 400 caracteres)' USING ERRCODE='22023'; END IF;
 count_items:=coalesce(cardinality(p_ids),0);
 IF count_items<1 OR count_items>20 OR
    (SELECT count(DISTINCT x) FROM unnest(p_ids) x)<>count_items OR array_position(p_ids,NULL) IS NOT NULL THEN
   RAISE EXCEPTION 'Selecione de 1 a 20 fichas únicas' USING ERRCODE='22023'; END IF;
 IF p_action NOT IN ('revisar','arquivar','restaurar','corrigir_nome','anotar') THEN
   RAISE EXCEPTION 'Ação histórica inválida' USING ERRCODE='22023'; END IF;
 IF p_action IN ('corrigir_nome','anotar') AND count_items<>1 THEN
   RAISE EXCEPTION 'A edição de texto exige selecionar somente uma ficha' USING ERRCODE='22023'; END IF;
 IF p_action='corrigir_nome' AND (char_length(clean_value)<3 OR char_length(clean_value)>100) THEN
   RAISE EXCEPTION 'Nome corrigido deve ter de 3 a 100 caracteres' USING ERRCODE='22023'; END IF;
 IF p_action='anotar' AND (char_length(clean_value)<8 OR char_length(clean_value)>800) THEN
   RAISE EXCEPTION 'Anotação administrativa precisa ter de 8 a 800 caracteres' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO count_found FROM public.legacy_review_profiles
  WHERE source_key='wordpress_20261108' AND wp_post_id=ANY(p_ids);
 IF count_found<>count_items THEN RAISE EXCEPTION 'Há fichas ausentes ou sem acesso' USING ERRCODE='P0002'; END IF;
 IF p_action='restaurar' AND EXISTS(
  SELECT 1 FROM public.legacy_review_profiles WHERE source_key='wordpress_20261108'
  AND wp_post_id=ANY(p_ids) AND demo_candidate
 ) THEN RAISE EXCEPTION 'Registros de demonstração não podem ser restaurados' USING ERRCODE='22023'; END IF;
 new_state:=CASE p_action WHEN 'revisar' THEN 'em_revisao' WHEN 'arquivar' THEN 'excluido'
                           WHEN 'restaurar' THEN 'pendente' ELSE NULL END;
 PERFORM set_config('eut.admin_reason',reason,true);
 FOR profile IN SELECT wp_post_id FROM public.legacy_review_profiles
  WHERE source_key='wordpress_20261108' AND wp_post_id=ANY(p_ids)
  ORDER BY wp_post_id FOR UPDATE LOOP
  IF new_state IS NOT NULL THEN
   INSERT INTO public.eut_legacy_profile_management(source_key,wp_post_id,record_state,updated_by)
   VALUES('wordpress_20261108',profile.wp_post_id,new_state,admin_id)
   ON CONFLICT(source_key,wp_post_id) DO UPDATE SET
    record_state=EXCLUDED.record_state,updated_by=admin_id,updated_at=now()
   RETURNING * INTO saved;
  ELSIF p_action='corrigir_nome' THEN
   INSERT INTO public.eut_legacy_profile_management(source_key,wp_post_id,corrected_name,updated_by)
   VALUES('wordpress_20261108',profile.wp_post_id,clean_value,admin_id)
   ON CONFLICT(source_key,wp_post_id) DO UPDATE SET
    corrected_name=EXCLUDED.corrected_name,updated_by=admin_id,updated_at=now()
   RETURNING * INTO saved;
  ELSIF p_action='anotar' THEN
   INSERT INTO public.eut_legacy_profile_management(source_key,wp_post_id,admin_notes,updated_by)
   VALUES('wordpress_20261108',profile.wp_post_id,clean_value,admin_id)
   ON CONFLICT(source_key,wp_post_id) DO UPDATE SET
    admin_notes=EXCLUDED.admin_notes,updated_by=admin_id,updated_at=now()
   RETURNING * INTO saved;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('updated',count_items,'action',p_action,'published',false);
END; $$;
REVOKE ALL ON FUNCTION public.eut_admin_legacy_action(bigint[],text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.eut_admin_legacy_action(bigint[],text,text,text) TO authenticated;

-- Verify no new public grants and all operations remain admin-only in their bodies/RLS.
DO $$
BEGIN
 IF has_table_privilege('anon','public.eut_legacy_profile_management','UPDATE') OR
    has_table_privilege('anon','public.eut_admin_management_log','INSERT') OR
    has_function_privilege('anon','public.eut_admin_legacy_action(bigint[],text,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous management privilege detected'; END IF;
 IF NOT has_function_privilege('authenticated','public.eut_admin_technician_action(uuid,text,jsonb,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Authenticated admin endpoint not executable'; END IF;
END $$;
COMMIT;