import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "docs/sql/eut-technician-self-service-no-confirmation-proposal-20261120.sql",
  "utf8",
);
const panel = readFileSync("src/routes/area-tecnico.tsx", "utf8");

describe("autosserviço técnico sem confirmação adicional", () => {
  it("mantém o cadastro editável e remove as duas interfaces OTP do painel", () => {
    expect(panel).toContain('activationDb.rpc("eut_publish_my_technician"');
    expect(panel).toContain("<TechnicianProfileRemoval");
    expect(panel).not.toContain("TechnicianEmailOtpVerification");
    expect(panel).not.toContain("PioneerPhoneVerification");
  });

  it("falha fechado se uma RPC original mudou; preserva autenticacao e conta operacional", () => {
    expect(sql.match(/'public\.eut_[a-z_]+\([^']*\)', '[a-f0-9]{32}'/g)).toHaveLength(8);
    expect(sql).toContain("RAISE EXCEPTION 'Autosservico alterado desde a auditoria");
    expect(sql).toContain("NOT public.eut_account_operational()");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("r.user_id = v_user AND r.role = 'tecnico'");
    expect(sql).toContain("pg_catalog.jsonb_build_object('state', 'removido'");
  });

  it("exclui somente a ficha pública do titular sem destruir históricos ou suspensões", () => {
    expect(sql).toContain("WHERE t.user_id = v_user FOR UPDATE");
    expect(sql).toContain("WHERE id = v_id AND user_id = v_user");
    expect(sql).toContain("WHERE user_id = v_user;");
    expect(sql).toContain("v_status IN ('suspenso'");
    expect(sql).toContain("'rejeitado'::public.approval_status");
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.technicians/i);
    expect(sql).toContain("technician_self_remove");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.eut_remove_my_technician_profile() TO authenticated",
    );
  });
});
