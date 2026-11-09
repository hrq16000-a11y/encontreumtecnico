CREATE TYPE public.request_status AS ENUM ('aberta','aceita','recusada','concluida','cancelada');

CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES public.technicians(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  city text NOT NULL,
  region text,
  status public.request_status NOT NULL DEFAULT 'aberta',
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.service_requests TO authenticated;
GRANT ALL ON public.service_requests TO service_role;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.my_technician_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.technicians WHERE user_id = auth.uid() AND status = 'aprovado' LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.my_technician_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_technician_id() TO authenticated;

CREATE POLICY "Client reads own" ON public.service_requests FOR SELECT TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Technician reads assigned or open" ON public.service_requests FOR SELECT TO authenticated
  USING (public.my_technician_id() IS NOT NULL AND (technician_id = public.my_technician_id() OR (technician_id IS NULL AND status = 'aberta')));
CREATE POLICY "Admin reads all" ON public.service_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Client opens" ON public.service_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id AND status = 'aberta' AND accepted_at IS NULL
    AND (technician_id IS NULL OR EXISTS (SELECT 1 FROM public.technicians t WHERE t.id = technician_id AND t.status = 'aprovado')));

CREATE TRIGGER trg_service_requests_updated BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_request_status(_id uuid, _status public.request_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.service_requests; tid uuid := public.my_technician_id();
BEGIN
  SELECT * INTO r FROM public.service_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF _status = 'cancelada' AND r.client_id = auth.uid() AND r.status IN ('aberta','aceita') THEN
    UPDATE public.service_requests SET status='cancelada' WHERE id=_id;
  ELSIF _status = 'aceita' AND tid IS NOT NULL AND r.status = 'aberta' AND (r.technician_id IS NULL OR r.technician_id = tid) THEN
    UPDATE public.service_requests SET status='aceita', technician_id=tid, accepted_at=now() WHERE id=_id;
  ELSIF _status = 'recusada' AND tid IS NOT NULL AND r.status = 'aberta' AND r.technician_id = tid THEN
    UPDATE public.service_requests SET status='recusada' WHERE id=_id;
  ELSIF _status = 'concluida' AND tid IS NOT NULL AND r.status = 'aceita' AND r.technician_id = tid THEN
    UPDATE public.service_requests SET status='concluida' WHERE id=_id;
  ELSE
    RAISE EXCEPTION 'Mudança de status não permitida';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_request_status(uuid, public.request_status) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_request_status(uuid, public.request_status) TO authenticated;

ALTER TYPE public.approval_status ADD VALUE IF NOT EXISTS 'suspenso';