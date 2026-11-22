-- Synthetic-only, PostgreSQL 17 ephemeral database; no hosted services.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA eut_moderation;
CREATE TABLE public.eut_ibge_municipalities (id integer PRIMARY KEY, name text, uf text);
CREATE TABLE eut_moderation.admin_technician_records (
  id uuid PRIMARY KEY, display_name text NOT NULL,
  category_slugs text[] NOT NULL DEFAULT '{}',
  service_slugs text[] NOT NULL DEFAULT '{}',
  city_ibge_id integer, declared_uf text, covers_entire_uf boolean NOT NULL DEFAULT false,
  coverage_notes text, region_approx text,
  admin_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false, archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE eut_moderation.admin_technician_record_contacts (
  record_id uuid PRIMARY KEY,
  phone_e164 text NOT NULL,
  contact_suspended boolean NOT NULL DEFAULT false
);
CREATE TABLE eut_moderation.blocked_phones (phone_digits text PRIMARY KEY);
CREATE TABLE eut_moderation.admin_technician_coverage (record_id uuid, city_ibge_id integer);
ALTER TABLE eut_moderation.admin_technician_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_moderation.admin_technician_record_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_moderation.blocked_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE eut_moderation.admin_technician_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA eut_moderation FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA eut_moderation FROM PUBLIC, anon, authenticated;
INSERT INTO public.eut_ibge_municipalities VALUES (4106902,'Curitiba','PR');
INSERT INTO eut_moderation.admin_technician_records (id,display_name,city_ibge_id,admin_active,is_demo,archived_at,created_at)
VALUES
 ('00000000-0000-4000-8000-000000000001','Valido sintetico',4106902,true,false,NULL,'2026-11-21T12:00:00Z'),
 ('00000000-0000-4000-8000-000000000002','Invalido sintetico',4106902,true,false,NULL,'2026-11-21T11:00:00Z'),
 ('00000000-0000-4000-8000-000000000003','Bloqueado sintetico',4106902,true,false,NULL,'2026-11-21T10:00:00Z'),
 ('00000000-0000-4000-8000-000000000004','Suspenso sintetico',4106902,true,false,NULL,'2026-11-21T09:00:00Z'),
 ('00000000-0000-4000-8000-000000000005','Inativo sintetico',4106902,false,false,NULL,'2026-11-21T08:00:00Z'),
 ('00000000-0000-4000-8000-000000000006','Demo sintetico',4106902,true,true,NULL,'2026-11-21T07:00:00Z'),
 ('00000000-0000-4000-8000-000000000007','Arquivado sintetico',4106902,true,false,now(),'2026-11-21T06:00:00Z');
INSERT INTO eut_moderation.admin_technician_record_contacts
 (record_id,phone_e164,contact_suspended)
VALUES
 ('00000000-0000-4000-8000-000000000001','+5541999887766',false),
 ('00000000-0000-4000-8000-000000000002','invalido',false),
 ('00000000-0000-4000-8000-000000000003','+5541999776655',false),
 ('00000000-0000-4000-8000-000000000004','+5541999665544',true),
 ('00000000-0000-4000-8000-000000000005','+5541999554433',false),
 ('00000000-0000-4000-8000-000000000006','+5541999443322',false),
 ('00000000-0000-4000-8000-000000000007','+5541999332211',false);
INSERT INTO eut_moderation.blocked_phones(phone_digits) VALUES ('5541999776655');
