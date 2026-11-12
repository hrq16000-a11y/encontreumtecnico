import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { rankTechniciansByDeclaredArea } from "./technician-local-ranking";

const sql = readFileSync("docs/sql/eut-public-referral-highlights-20261110.sql", "utf8");

describe("destaque por indicações confirmadas, sem comissão financeira", () => {
  it("retorna somente IDs públicos aprovados, nunca relações pessoais", () => {
    for (const item of [
      "RETURNS TABLE (technician_id uuid)",
      "cardinality(_technician_ids) BETWEEN 1 AND 200",
      "inviter.id = ANY(_technician_ids)",
      "inviter.status = 'aprovado'",
      "invited.status = 'aprovado'",
      "attribution.inviter_user_id <> attribution.invited_user_id",
      "HAVING count(DISTINCT invited.id) >= 2",
      "REVOKE ALL ON FUNCTION",
    ]) expect(sql).toContain(item);
    expect(sql).not.toMatch(/\b(?:RETURN|SELECT)\b[^\n]*\b(?:password|phone|email|invited_user_id)\b/i);
  });
  it("prioriza primeiro bairro e município, mesmo com selo de indicação", () => {
    const base = { city: "Tubarão", state_uf: "SC", neighborhood: "Centro",
      online_now: false, pioneer_bronze: false };
    const results = rankTechniciansByDeclaredArea([
      { ...base, id: "far", city: "Curitiba", state_uf: "PR", referral_highlight: true },
      { ...base, id: "near", referral_highlight: false },
    ], { uf: "SC", cidade: "Tubarão", bairro: "Centro" });
    expect(results.map(p=>p.id)).toEqual(["near","far"]);
  });
  it("usa destaque como desempate, nunca antes da disponibilidade online", () => {
    const base = { city: "Tubarão", state_uf: "SC", neighborhood: "Centro",
      pioneer_bronze: false };
    const results = rankTechniciansByDeclaredArea([
      { ...base, id: "featured-offline", online_now: false, referral_highlight: true },
      { ...base, id: "online", online_now: true, referral_highlight: false },
      { ...base, id: "plain-offline", online_now: false, referral_highlight: false },
    ], { uf: "SC", cidade: "Tubarão", bairro: "Centro" });
    expect(results.map(p=>p.id)).toEqual(["online","featured-offline","plain-offline"]);
  });
});
