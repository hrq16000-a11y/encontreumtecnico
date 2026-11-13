import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readPublicEligibleRows } from "./public-eligibility";
import { toSafePublicTechnician, publicLocationOrFallback } from "./technician-public-view";
import { formatPublicLocation } from "./location-labels";

const sample = (id: string, display_name: string | null, city: string | null) => ({
  id, display_name, city, state_uf: null, neighborhood: null,
  region: null, bio: null as string | null, specialties: [] as string[],
  service_slugs: [] as string[], coverage_city_ids: [] as number[],
});

describe("R2-compatible public SSR candidates (synthetic only)", () => {
  it("renders nullable admin fields only after authoritative RPC admits the ID", async () => {
    const candidates = [sample("approved-auth", "Técnica de Redes", "Curitiba"),
      sample("audited-admin", null, null), sample("unaudited-pending", null, null),
      sample("disabled", "Inativo", null)];
    let calls = 0;
    const eligible = await readPublicEligibleRows({
      rpc: async (name, params) => {
        calls++;
        expect(name).toBe("eut_public_eligible_technician_ids");
        expect(params._ids).toEqual(candidates.map(r => r.id));
        return { data: [
          { technician_id: "audited-admin" },
          { technician_id: "approved-auth" },
          { technician_id: "unrequested-private" },
        ], error: null };
      },
    }, candidates);
    expect(calls).toBe(1);
    expect(eligible.map(r => r.id)).toEqual(["approved-auth", "audited-admin"]);
    const shown = eligible.map(toSafePublicTechnician);
    expect(shown.map(r => r.display_name)).toEqual(["Técnica de Redes", "Profissional cadastrado"]);
    expect(shown[1]?.city).toBe("");
    expect(publicLocationOrFallback(formatPublicLocation(shown[1]!))).toBe("Localidade não informada");
  });

  it("masks unsafe names and bio without changing the original row", () => {
    const row = { ...sample("admin", "Contato 41 99999-8080", null),
      bio: "WhatsApp 41 99999-8080" };
    const safe = toSafePublicTechnician(row);
    expect(safe.display_name).toBe("Profissional cadastrado");
    expect(safe.bio).toBeNull();
    expect(row.bio).toContain("WhatsApp");
  });

  it("does not fabricate municipality, DDD, specialization or online state", () => {
    const raw = sample("phone-only", null, null);
    const safe = toSafePublicTechnician(raw);
    expect(safe.city).toBe("");
    expect(safe.state_uf).toBeNull();
    expect(safe.coverage_city_ids).toEqual([]);
    expect(safe.specialties).toEqual([]);
    expect(safe.service_slugs).toEqual([]);
    expect(publicLocationOrFallback(formatPublicLocation(safe))).toBe("Localidade não informada");
    expect(Object.keys(safe)).not.toContain("phone");
  });

  it("fails closed on missing eligibility RPC", async () => {
    await expect(readPublicEligibleRows({
      rpc: async () => ({ data: null, error: { message: "Unavailable" } }),
    }, [sample("pending", null, null)])).rejects.toThrow(/eligibility unavailable/);
  });

  it("preserves IBGE-only declared coverage and RPC-gated public search", () => {
    const src = readFileSync("src/lib/technicians.functions.ts", "utf8");
    expect(src.split('.in("status", ["aprovado", "pendente"])')).toHaveLength(3);
    expect(src).toContain('.contains("coverage_city_ids", [selectedCityId])');
    expect(src).toContain("readPublicEligibleRows(");
    expect(src).toContain("page.rows.map(toSafePublicTechnician)");
    expect(src).toContain("toSafePublicTechnician(eligible[0]!)");
    for (const privateTerm of ["SUPABASE_SERVICE_ROLE_KEY", "catalog_private_contacts", "catalog_provenance", "ddd_hint", "catalog_origin"]) {
      expect(src).not.toContain(privateTerm);
    }
  });
});
