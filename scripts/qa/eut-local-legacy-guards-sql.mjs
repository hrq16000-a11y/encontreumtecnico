// Generate ONLY the installed guards already recorded in the disposable
// PostgreSQL fixture. Never run on a hosted project or database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  'docs/sql/tests/eut-canonical-catalog-r1-live-guards-20261112.sql',
  'utf8',
);

function statement(prefix, closing = ';') {
  const start = source.indexOf(prefix);
  assert.ok(start >= 0, 'Missing provenance fixture statement: ' + prefix);
  const end = source.indexOf(closing, start + prefix.length);
  assert.ok(end >= 0, 'Unterminated provenance fixture statement: ' + prefix);
  return source.slice(start, end + closing.length);
}

// Eight new routines, plus the complete installed text validator replacing
// the local-only abbreviated helper (9 function definitions total).
const functions = [
  'eut_profile_security.is_unsafe_public_text',
  'eut_profile_security.block_unsafe_public_profile',
  'eut_migration.guard_technician_approval',
  'public.eut_validate_technician_city_and_coverage',
  'public.eut_validate_technician_services',
  'eut_moderation.reject_restricted_publication',
  'eut_moderation.eut_audit_admin_technician',
  'eut_moderation.reject_restricted_phone',
  'eut_pioneers.award_bronze_after_publish',
];
const triggers = [
  'eut_block_public_contact_disclosure',
  'eut_check_technician_services',
  'eut_restrict_technician_publication',
  'eut_technician_approval_quality',
  'eut_technician_city_coverage_guard',
  'eut_admin_audit_technician',
  'eut_pioneer_bronze_publish',
  'eut_restrict_private_contact',
];
assert.equal(new Set(functions).size, 9);
assert.equal(new Set(triggers).size, 8);

const sql = [
  'BEGIN;',
  '-- Local-only dependencies of the existing pioneer AFTER trigger.',
  'CREATE SCHEMA eut_pioneers;',
  statement('CREATE TABLE eut_pioneers.pre_registrations('),
  statement('CREATE TABLE public.eut_pioneer_badges('),
  'ALTER TABLE public.eut_pioneer_badges ENABLE ROW LEVEL SECURITY;',
  'REVOKE ALL ON public.eut_pioneer_badges FROM PUBLIC, anon, authenticated;',
  ...functions.map(name => statement(
    'CREATE OR REPLACE FUNCTION ' + name + '(', '$function$;')),
  ...triggers.map(name => statement('CREATE TRIGGER ' + name)),
  // Faithfully reproduce the original PERMISSIVE policy. Test for bypass.
  statement('CREATE POLICY eut_new_technicians_not_restricted'),
  // The local shim revoked this helper; the installed trigger is invoker.
  'GRANT USAGE ON SCHEMA eut_profile_security TO authenticated;',
  'GRANT EXECUTE ON FUNCTION eut_profile_security.is_unsafe_public_text(text,boolean) TO authenticated;',
  'DO $qa$',
  'DECLARE tech_triggers integer; phone_triggers integer; policy_count integer;',
  'BEGIN',
  "SELECT count(*) INTO tech_triggers FROM pg_trigger WHERE tgrelid='public.technicians'::regclass AND NOT tgisinternal;",
  "SELECT count(*) INTO phone_triggers FROM pg_trigger WHERE tgrelid='public.eut_technician_private_contacts'::regclass AND NOT tgisinternal;",
  "SELECT count(*) INTO policy_count FROM pg_policies WHERE schemaname='public' AND tablename IN ('technicians','eut_admin_management_log');",
  "IF tech_triggers<>10 OR phone_triggers<>1 OR policy_count<>12 THEN RAISE EXCEPTION 'Local guard inventory mismatch: %, %, %',tech_triggers,phone_triggers,policy_count; END IF;",
  'END $qa$;',
  'COMMIT;',
];
process.stdout.write(sql.join('\n\n') + '\n');
