CREATE TABLE public.search_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text NOT NULL DEFAULT 'Todas' CHECK (char_length(category)<=80), city text NOT NULL DEFAULT '' CHECK (char_length(city)<=80), region text NOT NULL DEFAULT '' CHECK (char_length(region)<=80), filters text[] NOT NULL DEFAULT '{}' CHECK (filters <@ ARRAY['especialidade','cidade','regiao']::text[]), result_count integer NOT NULL DEFAULT 0 CHECK (result_count>=0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT INSERT ON public.search_events TO anon, authenticated;
GRANT SELECT ON public.search_events TO authenticated;
GRANT ALL ON public.search_events TO service_role;
ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visitors record searches" ON public.search_events FOR INSERT TO anon, authenticated WITH CHECK (created_at <= now() AND created_at >= now() - interval '1 minute');
CREATE POLICY "Admins read searches" ON public.search_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX search_events_created_at_idx ON public.search_events(created_at);
CREATE TRIGGER search_events_updated BEFORE UPDATE ON public.search_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE FUNCTION public.admin_search_metrics() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE summary jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 WITH recent AS (SELECT * FROM public.search_events WHERE created_at >= now()-interval '30 days')
 SELECT jsonb_build_object('total',(SELECT count(*) FROM recent),'categories',COALESCE((SELECT jsonb_agg(x) FROM (SELECT category AS label,count(*)::integer AS value FROM recent GROUP BY category ORDER BY count(*) DESC LIMIT 10) x),'[]'::jsonb),'cities',COALESCE((SELECT jsonb_agg(x) FROM (SELECT CASE WHEN city='' THEN 'Não informada' ELSE city END AS label,count(*)::integer AS value FROM recent GROUP BY 1 ORDER BY count(*) DESC LIMIT 10) x),'[]'::jsonb),'filters',COALESCE((SELECT jsonb_agg(x) FROM (SELECT f AS label,count(*)::integer AS value FROM recent CROSS JOIN LATERAL unnest(filters) f GROUP BY f ORDER BY count(*) DESC) x),'[]'::jsonb)) INTO summary;
 RETURN summary;
END $$;
REVOKE ALL ON FUNCTION public.admin_search_metrics() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_search_metrics() TO authenticated,service_role;