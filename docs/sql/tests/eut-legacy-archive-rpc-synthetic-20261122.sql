-- SYNTHETIC ONLY: run on a disposable PostgreSQL fixture AFTER installing
-- the proposal there. NEVER run this file on the hosted Supabase project.
-- No real customer/technician rows, secrets, contacts or business-table reads.
-- This checks SQL sanitization itself, not just a TypeScript regex analogue.

BEGIN;
DO $fixture$
DECLARE
  example record;
  actual text;
BEGIN
  FOR example IN
    SELECT raw, expected FROM (VALUES
      ('alexa@example.test',              'Técnico'),
      ('Maria Costa contato@empresa.com.br', 'Técnico'),
      ('(41) 99999-1234',                'Técnico'),
      ('Suporte +55 (11) 98888-7777',    'Técnico'),
      ('Atendimento 3333-4444',          'Técnico'),
      ('https://exemplo.com/contato',    'Técnico'),
      ('www.exemplo.com.br',             'Técnico'),
      ('wa.me/5541999991234',            'Técnico'),
      ('@perfil_tecnico',                'Técnico'),
      ('Suporte WhatsApp',               'Técnico'),
      ('Empresa site.com',               'Técnico'),
      ('',                               'Técnico'),
      ('Ana Costa',                      'Ana Costa'),
      ('Alex Paixao',                    'Alex Paixao'),
      ('alexpaixao13',                   'alexpaixao13')
    ) AS synthetic(raw, expected)
  LOOP
    actual := eut_legacy_internal.public_legacy_name(example.raw);
    IF actual IS DISTINCT FROM example.expected THEN
      RAISE EXCEPTION 'synthetic public legacy name mismatch';
    END IF;
  END LOOP;
END;
$fixture$;
ROLLBACK;

-- Separate future disposable-DB QA must also validate:
-- anonymous RPC permission; no direct private-schema access; NULL/invalid
-- pagination errors; exact total and ordering; empty page; category-tag
-- redaction; equivalence with TS fixtures; and direct-table SELECT revoked
-- only in the later, separately authorized cutover.
