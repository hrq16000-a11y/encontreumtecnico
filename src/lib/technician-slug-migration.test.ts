import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("docs/sql/eut-technician-public-slugs-20261110.sql", "utf8");
describe("URLs públicas permanentes dos técnicos", () => {
  it("aloca slug legível via trigger no banco, com índice único e migração", () => {
    for (const piece of [
      "ADD COLUMN IF NOT EXISTS public_slug",
      "technician_public_slug_base",
      "eut_assign_technician_public_slug",
      "ON public.technicians",
      "CREATE UNIQUE INDEX IF NOT EXISTS",
      "ALTER COLUMN public_slug SET NOT NULL",
      "IF TG_OP = 'UPDATE' AND OLD.public_slug IS NOT NULL",
      "WHERE t.public_slug = base AND t.id <> NEW.id",
      "COMMIT;",
    ]) expect(sql).toContain(piece);
  });
  it("não toca em contas, contatos ou classificação do prestador", () => {
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE FROM|INSERT INTO)\s+(?:auth\.|public\.eut_technician_private_contacts|public\.user_roles)/i);
    expect(sql).not.toMatch(/SET\s+status\s*=|service_role|password|payment/i);
    expect(sql).toContain("REVOKE ALL ON FUNCTION");
  });
});
