-- EUT / Isolated historical contractor review overlay; original WP rows remain immutable.
-- Requires docs/sql/eut-admin-management-actions-20261111.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS public.eut_legacy_employer_management (
  source_key text NOT NULL DEFAULT 'wordpress_20261108' CHECK(source_key='wordpress_20261108'),
  wp_post_id bigint NOT NULL,
  record_state text NOT NULL DEFAULT 'pendente'
    CHECK(record_state IN ('pendente','em_revisao','pronto_para_validacao','excluido')),
  corrected_name text NULL
    CHECK(corrected_name IS NULL OR char_length(btrim(corrected_name)) BETWEEN 3 AND 100),
  admin_notes text NOT NULL DEFAULT '' CHECK(char_length(admin_notes)<=800),
  updated_by uuid NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_key,wp_post_id),
  CONSTRAINT eut_legacy_employer_fk FOREIGN KEY(source_key,wp_post_id)
    REFERENCES public.legacy_review_profiles(source_key,wp_post_id) ON DELETE RESTRICT
);
ALTER TABLE public.eut_legacy_employer_management ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eut_legacy_employer_admin_read ON public.eut_legacy_employer_management;
CREATE POLICY eut_legacy_employer_admin_read ON public.eut_legacy_employer_management
 FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'admin'::public.app_role));
DROP POLICY IF EXISTS eut_legacy_employer_admin_insert ON public.eut_legacy_employer_management;
CREATE POLICY eut_legacy_employer_admin_insert ON public.eut_legacy_employer_management
 FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'admin'::public.app_role));
DROP POLICY IF EXISTS eut_legacy_employer_admin_update ON public.eut_legacy_employer_management;
CREATE POLICY eut_legacy_employer_admin_update ON public.eut_legacy_employer_management
 FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'admin'::public.app_role))
 WITH CHECK (auth.uid() IS NOT NULL AND public.has_role(auth.uid(),'admin'::public.app_role));
REVOKE ALL ON public.eut_legacy_employer_management FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.eut_legacy_employer_management TO authenticated;

CREATE OR REPLACE FUNCTION eut_migration.eut_guard_managed_employer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind_name text; is_demo boolean;
BEGIN
 SELECT kind,demo_candidate INTO kind_name,is_demo FROM public.legacy_review_profiles
 WHERE source_key=NEW.source_key AND wp_post_id=NEW.wp_post_id;
 IF kind_name IS DISTINCT FROM 'employer' THEN
  RAISE EXCEPTION 'Only legacy contracting clients can be managed in this overlay'; END IF;
 IF is_demo AND NEW.record_state<>'excluido' THEN
  RAISE EXCEPTION 'Demonstration contractors cannot be activated'; END IF;
 NEW.updated_by=auth.uid();
 NEW.updated_at=now();
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS eut_legacy_guard_employer ON public.eut_legacy_employer_management;
CREATE TRIGGER eut_legacy_guard_employer BEFORE INSERT OR UPDATE ON public.eut_legacy_employer_management
 FOR EACH ROW EXECUTE FUNCTION eut_migration.eut_guard_managed_employer();
DROP TRIGGER IF EXISTS eut_admin_audit_legacy_employer ON public.eut_legacy_employer_management;
CREATE TRIGGER eut_admin_audit_legacy_employer AFTER INSERT OR UPDATE OF record_state,corrected_name,admin_notes
 ON public.eut_legacy_employer_management FOR EACH ROW EXECUTE FUNCTION eut_moderation.eut_audit_admin_legacy();

CREATE OR REPLACE FUNCTION public.eut_admin_legacy_action(
 p_ids bigint[], p_action text, p_value text, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE admin_id uuid:=auth.uid(); reason text:=btrim(coalesce(p_reason,''));
        count_items integer; count_found integer; profile record;
        table_name text; new_state text; clean_value text:=btrim(coalesce(p_value,''));
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
 IF p_action<>'arquivar' AND EXISTS(
  SELECT 1 FROM public.legacy_review_profiles WHERE source_key='wordpress_20261108'
  AND wp_post_id=ANY(p_ids) AND demo_candidate
 ) THEN RAISE EXCEPTION 'Registros de demonstração só podem ser arquivados' USING ERRCODE='22023'; END IF;
 new_state:=CASE p_action WHEN 'revisar' THEN 'em_revisao' WHEN 'arquivar' THEN 'excluido'
                           WHEN 'restaurar' THEN 'pendente' ELSE NULL END;
 PERFORM set_config('eut.admin_reason',reason,true);
 FOR profile IN SELECT wp_post_id,kind,demo_candidate FROM public.legacy_review_profiles
  WHERE source_key='wordpress_20261108' AND wp_post_id=ANY(p_ids)
  ORDER BY wp_post_id LOOP
  table_name:=CASE profile.kind WHEN 'candidate' THEN 'eut_legacy_profile_management'
                                WHEN 'employer' THEN 'eut_legacy_employer_management' ELSE NULL END;
  IF table_name IS NULL THEN RAISE EXCEPTION 'Tipo de ficha histórica desconhecido'; END IF;
  IF new_state IS NOT NULL THEN
   EXECUTE format('INSERT INTO public.%I(source_key,wp_post_id,record_state,updated_by)
      VALUES($1,$2,$3,$4) ON CONFLICT(source_key,wp_post_id)
      DO UPDATE SET record_state=EXCLUDED.record_state,updated_by=$4,updated_at=now()',table_name)
     USING 'wordpress_20261108',profile.wp_post_id,new_state,admin_id;
  ELSIF p_action='corrigir_nome' THEN
   EXECUTE format('INSERT INTO public.%I(source_key,wp_post_id,corrected_name,updated_by)
      VALUES($1,$2,$3,$4) ON CONFLICT(source_key,wp_post_id)
      DO UPDATE SET corrected_name=EXCLUDED.corrected_name,updated_by=$4,updated_at=now()',table_name)
     USING 'wordpress_20261108',profile.wp_post_id,clean_value,admin_id;
  ELSIF p_action='anotar' THEN
   EXECUTE format('INSERT INTO public.%I(source_key,wp_post_id,admin_notes,updated_by)
      VALUES($1,$2,$3,$4) ON CONFLICT(source_key,wp_post_id)
      DO UPDATE SET admin_notes=EXCLUDED.admin_notes,updated_by=$4,updated_at=now()',table_name)
     USING 'wordpress_20261108',profile.wp_post_id,clean_value,admin_id;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('updated',count_items,'action',p_action,'published',false);
END $$;
REVOKE ALL ON FUNCTION public.eut_admin_legacy_action(bigint[],text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.eut_admin_legacy_action(bigint[],text,text,text) TO authenticated;
DO $$ BEGIN
 IF has_table_privilege('anon','public.eut_legacy_employer_management','SELECT') OR
    has_table_privilege('anon','public.eut_legacy_employer_management','UPDATE') OR
    has_function_privilege('anon','public.eut_admin_legacy_action(bigint[],text,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous historical management access detected'; END IF;
END $$;
COMMIT;