import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "docs/sql/eut-admin-technician-crud-staging-proposal-20261111.sql",
  "utf8",
);
const assertions = readFileSync(
  "docs/sql/tests/eut-admin-crud-ephemeral-assertions-20261111.sql",
  "utf8",
);
const fixture = readFileSync("docs/sql/tests/eut-admin-crud-ephemeral-schema-20261111.sql", "utf8");
const workflow = readFileSync(".github/workflows/eut-admin-rpc-ephemeral.yml", "utf8");

describe("contrato de homologação isolada do CRUD administrativo", () => {
  it("continua explicitamente não instalado e com privilégio concedido só a autenticados", () => {
    expect(sql).toContain("PROPOSAL ONLY. NOT INSTALLED");
    expect(sql).toContain("SECURITY DEFINER SET search_path='pg_catalog'");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("v_before.updated_at IS DISTINCT FROM _expected_updated_at");
    expect(sql).toContain("eut_admin_management_log");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
    expect(sql).toContain("TO authenticated");
    expect(sql).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("cobre cenários privados, bloqueios, versões e rollback nos fixtures descartáveis", () => {
    for (const required of [
      "Anonymous execute not denied",
      "Stale version accepted",
      "Duplicate phone accepted",
      "Audit failure did not roll back",
      "Restore incorrectly approved/unbanned/shared contact",
      "Keep operation unexpectedly modified private contact",
      "Remove contact did not preserve account ban",
      "Private contact audit missing, or full phone leaked",
      "Blocked destination phone accepted",
      "Unknown payload key accepted",
      "Unknown municipality accepted",
      "Archive audit failure did not roll back",
      "Archive transaction partially committed after failed audit",
    ])
      expect(assertions).toContain(required);
    expect(assertions).not.toContain("SUPABASE_URL");
  });

  it("restringe a execução SQL ao PostgreSQL descartável no gate de PR", () => {
    expect(fixture).toContain("current_database() <> 'eut_fixture'");
    expect(fixture).toContain("current_user <> 'eut_fixture'");
    expect(fixture).toContain(
      "Refusing SQL fixture outside a clean, disposable eut_fixture database",
    );
    expect(workflow).toContain("on:\n  pull_request:");
    expect(workflow).toContain("image: postgres:16-alpine");
    expect(workflow).toContain("PGDATABASE: eut_fixture");
    expect(workflow).toContain("ON_ERROR_STOP=1");
    expect(workflow).not.toContain("workflow_dispatch:");
    expect(workflow).not.toContain("supabase db push");
    expect(workflow).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
