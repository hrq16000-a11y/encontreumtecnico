import type { LocalLegalWriteResult } from "./assistant-legal-ledger-local-writer-proposal.server";
import type { LocalLegalVerifiedPgTransaction } from "./assistant-legal-auth-supabase-binding-proposal.server";

/**
 * Issue #261 — inert server-only transaction adapter. No Pool, credentials,
 * hosted connection, SQL execution or exposed route is created in this module.
 * A future trusted server handler MUST pass only a verified subject from
 * requireSupabaseAuth and a dedicated non-superuser/non-BYPASSRLS PG pool.
 * The pool login must be allowed to SET ROLE eut_legal_local_writer, a NOLOGIN
 * role with reviewed RLS grants. Never pass supabaseAdmin/service-role here.
 */
export type LocalPgClient = Readonly<{
  query: (statement: string, parameters?: readonly unknown[]) => Promise<{ rows: unknown }>;
  release: () => void;
}>;

export type LocalPgPool = Readonly<{
  connect: () => Promise<LocalPgClient>;
}>;

export const LOCAL_LEGAL_EFFECTIVE_ROLE = "eut_legal_local_writer";

const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

const CHECK_ROLES = `
SELECT current_user::text AS effective_role,
       effective.rolsuper AS effective_superuser,
       effective.rolbypassrls AS effective_bypassrls,
       login.rolsuper AS login_superuser,
       login.rolbypassrls AS login_bypassrls
FROM pg_catalog.pg_roles AS effective
JOIN pg_catalog.pg_roles AS login ON login.rolname = session_user
WHERE effective.rolname = current_user
`;

function exactlyOneRow(response: { rows: unknown }): Record<string, unknown> | null {
  if (!Array.isArray(response?.rows) || response.rows.length !== 1) return null;
  const row: unknown = response.rows[0];
  return row && typeof row === "object" && !Array.isArray(row)
    ? row as Record<string, unknown> : null;
}

/**
 * Checks both session and effective roles before sending any legal command.
 * `eut_account_operational()` is only versioned in a SQL contract: if missing,
 * ungranted or false, the transaction aborts. Its installation is NOT assumed.
 * The upstream boundary also requires server-owned role and account checks.
 */
export function createProposedLocalPgSubjectTransaction(
  pool: LocalPgPool,
): LocalLegalVerifiedPgTransaction {
  return async (verifiedSubject, operation): Promise<LocalLegalWriteResult> => {
    if (!UUID.test(verifiedSubject)) throw new Error("unverified_legal_subject");

    const client = await pool.connect();
    let began = false;
    try {
      await client.query("BEGIN");
      began = true;
      await client.query(`SET LOCAL ROLE ${LOCAL_LEGAL_EFFECTIVE_ROLE}`);

      const role = exactlyOneRow(await client.query(CHECK_ROLES));
      if (!role || role.effective_role !== LOCAL_LEGAL_EFFECTIVE_ROLE ||
          role.effective_superuser !== false || role.effective_bypassrls !== false ||
          role.login_superuser !== false || role.login_bypassrls !== false) {
        throw new Error("untrusted_legal_pg_role");
      }

      // The subject is derived from the verified middleware, NEVER request JSON.
      // `true` scopes the JWT claim to this transaction only.
      await client.query(
        "SELECT pg_catalog.set_config('request.jwt.claim.sub', $1::text, true)",
        [verifiedSubject],
      );
      const subject = exactlyOneRow(await client.query(
        "SELECT auth.uid()::text AS verified_subject",
      ));
      if (typeof subject?.verified_subject !== "string" ||
          subject.verified_subject.toLowerCase() !== verifiedSubject.toLowerCase()) {
        throw new Error("unbound_legal_pg_subject");
      }

      // Requires a separately reviewed EXECUTE grant for this restricted role.
      // Any missing function/grant, false result or malformed response aborts.
      const operational = exactlyOneRow(await client.query(
        "SELECT public.eut_account_operational() AS operational",
      ));
      if (operational?.operational !== true) {
        throw new Error("inactive_legal_account");
      }

      const result = await operation((statement, parameters) =>
        client.query(statement, [...parameters]));
      if (!result || ![
        "appended", "replayed", "idempotency_conflict", "no_active_acceptance",
      ].includes(result.status)) {
        throw new Error("abort_untrusted_legal_transaction");
      }
      await client.query("COMMIT");
      began = false;
      return result;
    } catch (error) {
      if (began) {
        try { await client.query("ROLLBACK"); } catch { /* never commit on rollback failure */ }
      }
      throw error;
    } finally {
      client.release();
    }
  };
}
