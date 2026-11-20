-- psql -v owner_id=... -v other_id=... etc; valores todos IDs Auth locais.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.user_roles(user_id, role) VALUES
  (:'owner_id'::uuid, 'tecnico'), (:'other_id'::uuid, 'tecnico'),
  (:'suspended_id'::uuid, 'tecnico'), (:'blocked_id'::uuid, 'tecnico'),
  (:'client_id'::uuid, 'cliente'), (:'admin_id'::uuid, 'admin');
INSERT INTO public.technicians(user_id,display_name,city,state_uf,status,specialties,service_slugs)
VALUES (:'suspended_id'::uuid,'Tecnico suspenso sintético','Curitiba','PR','suspenso',
  ARRAY['informatica'],ARRAY['formatacao']);
INSERT INTO eut_moderation.blocked_accounts(user_id) VALUES (:'blocked_id'::uuid);
COMMIT;
