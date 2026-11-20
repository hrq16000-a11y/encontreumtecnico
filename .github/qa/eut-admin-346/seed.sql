-- psql variable substitution is used only for freshly created local GoTrue IDs.
INSERT INTO public.eut_qa_roles(user_id, role)
VALUES (:'admin_id'::uuid, 'admin');
INSERT INTO public.technicians(id, user_id, status, display_name)
VALUES (:'record_id'::uuid, :'tech_id'::uuid, 'pendente', 'Técnico sintético QA 346');
