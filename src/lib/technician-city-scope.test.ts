import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { matchingOfficialMunicipalityId, collectEligibleMunicipalPage, MUNICIPAL_PAGE_SIZE } from "./technician-city-scope";
const ref = { id: 4125506, name: "São José dos Pinhais", uf: "PR" };
describe("busca na cobertura IBGE existente", () => {
  it("recusa município divergente e não infere a cidade por texto", () => {
    expect(matchingOfficialMunicipalityId("4125506", ref, "PR", "Sao Jose dos Pinhais")).toBe(4125506);
    expect(matchingOfficialMunicipalityId("4125506", ref, "SC", ref.name)).toBeNull();
    expect(matchingOfficialMunicipalityId("4106902", ref, "PR", ref.name)).toBeNull();
    expect(matchingOfficialMunicipalityId("4125506", ref, "PR", "Curitiba")).toBeNull();
    expect(matchingOfficialMunicipalityId("4125506", null, "PR", ref.name)).toBeNull();
    expect(matchingOfficialMunicipalityId("41%", ref, "PR", ref.name)).toBeNull();
  });
  it("usa os técnicos existentes, checa elegibilidade e oculta legado na busca oficial", () => {
    const api = readFileSync("src/lib/technicians.functions.ts", "utf8");
    const ui = readFileSync("src/routes/tecnicos.index.tsx", "utf8");
    expect(api).toContain('.contains("coverage_city_ids", [selectedCityId])');
    expect(api).toContain("readPublicEligibleRows(");
    expect(api).toContain("collectEligibleMunicipalPage(");
    expect(api).toContain(".range(from, to)");
    expect(ui).toContain("!search.municipio_ibge && canShowLegacyArchive(search)");
    expect(api).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

describe("páginas reais de técnicos elegíveis", () => {
  const candidates = Array.from({ length: 220 }, (_, n) => ({ id: "tec-" + (n + 1) }));
  const allowed = new Set(candidates.slice(130, 185).map(row => row.id));
  const readCandidates = async (from: number, to: number) => candidates.slice(from, to + 1);
  const readEligible = async (rows: typeof candidates) => rows.filter(row => allowed.has(row.id));

  it("ultrapassa um lote inteiro inelegível e preenche uma página de 50", async () => {
    const page = await collectEligibleMunicipalPage({ page: 1, readCandidates, readEligible });
    expect(page.rows).toHaveLength(MUNICIPAL_PAGE_SIZE);
    expect(page.rows[0]?.id).toBe(candidates[130]?.id);
    expect(page.rows[49]?.id).toBe(candidates[179]?.id);
    expect(page.hasMore).toBe(true);
  });

  it("reaproveita os mesmos candidatos sem perder/duplicar elegíveis na página seguinte", async () => {
    const second = await collectEligibleMunicipalPage({ page: 2, readCandidates, readEligible });
    expect(second.rows.map(row => row.id)).toEqual(candidates.slice(180, 185).map(row => row.id));
    expect(second.hasMore).toBe(false);
    expect(await collectEligibleMunicipalPage({ page: 3, readCandidates, readEligible }))
      .toEqual({ rows: [], hasMore: false });
  });

  it("não ativa Próxima quando há exatamente 50 elegíveis", async () => {
    const only = new Set(candidates.slice(100, 150).map(row => row.id));
    const page = await collectEligibleMunicipalPage({ page: 1, readCandidates,
      readEligible: async rows => rows.filter(row => only.has(row.id)) });
    expect(page.rows).toHaveLength(50);
    expect(page.hasMore).toBe(false);
  });

  it("falha fechado quando a RPC de elegibilidade está indisponível", async () => {
    await expect(collectEligibleMunicipalPage({ page: 1, readCandidates,
      readEligible: async () => { throw new Error("Public technician eligibility unavailable"); } }))
      .rejects.toThrow(/eligibility unavailable/);
  });

  it("rejeita IDs retornados fora do lote da consulta aprovada", async () => {
    await expect(collectEligibleMunicipalPage({ page: 1, readCandidates,
      readEligible: async () => [{ id: "id-forjado" }] }))
      .rejects.toThrow(/fora do lote/);
  });

  it("não inventa ausência de técnicos quando 5000 candidatos não bastam", async () => {
    let reads = 0;
    await expect(collectEligibleMunicipalPage({
      page: 1,
      readCandidates: async (from, to) => {
        reads++;
        return Array.from({ length: to - from + 1 }, (_, i) => ({ id: "id-" + (from + i) }));
      },
      readEligible: async () => [],
    })).rejects.toThrow(/limite seguro de leitura/);
    expect(reads).toBe(50);
  });
});
