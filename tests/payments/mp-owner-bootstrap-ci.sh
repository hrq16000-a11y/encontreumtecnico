#!/usr/bin/env bash
set -euo pipefail
[[ "$PGHOST" == '127.0.0.1' && "$PGDATABASE" == 'eut_fixture' ]] || { echo 'local fixture only'; exit 1; }
SQL_FILE='docs/sql/eut-owner-bootstrap-reconcile-20261120.sql'
FIXTURE='tests/payments/mp-owner-bootstrap-ephemeral-fixture.sql'
q(){ psql -X -v ON_ERROR_STOP=1 -tAc "$1" | tr -d '\n'; }
assert(){ local result; result="$(q "$1")"; [[ "$result" == "$2" ]] || { echo "FAIL $3 ($result)"; exit 1; }; echo "PASS $3"; }
denied(){
  if psql -X -v ON_ERROR_STOP=1 -f "$SQL_FILE" >/tmp/eut-owner-failure.log 2>&1; then
    echo "FAIL expected refusal: $1"; exit 1
  fi
  assert "SELECT claimed_user_id IS NULL AND claimed_at IS NULL FROM eut_migration.project_owner_bootstrap" t "rollback $1"
  assert "SELECT to_regclass('eut_migration.mp_owner_bootstrap_audit') IS NULL" t "no audit $1"
}
psql -X -v ON_ERROR_STOP=1 -f "$FIXTURE" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO public.user_roles VALUES('10000000-0000-4000-8000-000000000002','admin')" >/dev/null
denied 'extra administrator'
psql -X -v ON_ERROR_STOP=1 -c "DELETE FROM public.user_roles WHERE user_id='10000000-0000-4000-8000-000000000002'" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "UPDATE auth.identities SET identity_data=jsonb_set(identity_data,'{email_verified}','\"false\"') WHERE user_id='10000000-0000-4000-8000-000000000001'" >/dev/null
denied 'unverified Google'
psql -X -v ON_ERROR_STOP=1 -c "UPDATE auth.identities SET identity_data=jsonb_set(identity_data,'{email_verified}','\"true\"') WHERE user_id='10000000-0000-4000-8000-000000000001'" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "UPDATE auth.sessions SET not_after=now()-interval '1 day'" >/dev/null
denied 'expired session'
psql -X -v ON_ERROR_STOP=1 -c "UPDATE auth.sessions SET not_after=now()+interval '1 day'" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO eut_moderation.blocked_accounts VALUES('10000000-0000-4000-8000-000000000001')" >/dev/null
denied 'blocked account'
psql -X -v ON_ERROR_STOP=1 -c "DELETE FROM eut_moderation.blocked_accounts" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO eut_moderation.blocked_phones VALUES('12345')" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "UPDATE public.eut_technician_private_contacts SET phone_e164='+12345'" >/dev/null
denied 'blocked phone'
psql -X -v ON_ERROR_STOP=1 -c "DELETE FROM eut_moderation.blocked_phones" >/dev/null
psql -X -v ON_ERROR_STOP=1 -c "ALTER TABLE eut_migration.project_owner_bootstrap DISABLE ROW LEVEL SECURITY" >/dev/null
denied 'RLS off'
psql -X -v ON_ERROR_STOP=1 -c "ALTER TABLE eut_migration.project_owner_bootstrap ENABLE ROW LEVEL SECURITY" >/dev/null
psql -X -v ON_ERROR_STOP=1 -f "$SQL_FILE" >/dev/null
assert "SELECT claimed_user_id IS NOT NULL AND claimed_at IS NOT NULL FROM eut_migration.project_owner_bootstrap" t 'owner linked'
assert "SELECT count(*) FROM eut_migration.mp_owner_bootstrap_audit" 1 'single audit'
assert "SELECT count(*) FROM public.user_roles WHERE role='admin'" 1 'roles unchanged'
assert "SELECT relrowsecurity FROM pg_class WHERE oid='eut_migration.mp_owner_bootstrap_audit'::regclass" t 'audit RLS'
assert "SELECT NOT has_table_privilege('authenticated','eut_migration.mp_owner_bootstrap_audit','SELECT')" t 'no user audit read'
assert "SELECT NOT has_table_privilege('anon','eut_migration.mp_owner_bootstrap_audit','SELECT')" t 'no anon audit read'
assert "SELECT count(*) FROM public.mp_protected_sentinels" 3 'suspended pioneer private sentinels'
if psql -X -v ON_ERROR_STOP=1 -f "$SQL_FILE" >/tmp/eut-owner-repeat.log 2>&1; then echo 'FAIL duplicate accepted'; exit 1; fi
assert "SELECT count(*) FROM eut_migration.mp_owner_bootstrap_audit" 1 'repeat denied'
createdb -h "$PGHOST" -U "$PGUSER" eut_concurrent
PGDATABASE=eut_concurrent psql -X -v ON_ERROR_STOP=1 -f "$FIXTURE" >/dev/null
set +e
(PGDATABASE=eut_concurrent psql -X -v ON_ERROR_STOP=1 -f "$SQL_FILE" >/tmp/eut-race-a.log 2>&1) & a=$!
(PGDATABASE=eut_concurrent psql -X -v ON_ERROR_STOP=1 -f "$SQL_FILE" >/tmp/eut-race-b.log 2>&1) & b=$!
wait "$a"; sa=$?
wait "$b"; sb=$?
set -e
if ! { [[ "$sa" == 0 && "$sb" != 0 ]] || [[ "$sa" != 0 && "$sb" == 0 ]]; }; then
  echo "FAIL race ($sa/$sb)"; exit 1
fi
r="$(PGDATABASE=eut_concurrent psql -X -tAc "SELECT count(*)=1 FROM eut_migration.mp_owner_bootstrap_audit" | tr -d '\n')"
[[ "$r" == t ]] || { echo 'FAIL race audit'; exit 1; }
echo 'PASS one winner, one audit in concurrent PostgreSQL sessions'
