import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  candidates: [] as Array<Record<string, unknown>>,
  blockedIds: new Set<string>(),
  baseReads: 0,
  coverageReads: 0,
  municipalityReads: 0,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: () => ({ handler: (fn: (...args: never[]) => unknown) => fn }) }),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => undefined,
  setResponseHeader: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      let requestedUf: string | null = null;
      let requestedCity: string | null = null;
      let coverageIds: number[] | null = null;
      const query = {
        select: () => query,
        eq: (field: string, value: string) => {
          if (field === "state_uf") requestedUf = value;
          return query;
        },
        ilike: (field: string, value: string) => {
          if (field === "city") requestedCity = value.replace(/%/g, "").toLowerCase();
          return query;
        },
        overlaps: (_field: string, ids: number[]) => {
          coverageIds = ids;
          return query;
        },
        contains: () => query,
        order: () => query,
        limit: async () => {
          if (table === "eut_ibge_municipalities") state.municipalityReads++;
          return { data: table === "eut_ibge_municipalities" ? [{ id: 4106902 }] : [], error: null };
        },
        in: async (_field: string, ids: number[]) => ({
          data: table === "eut_ibge_municipalities" && ids.includes(4106902)
            ? [{ id: 4106902, name: "Curitiba", uf: "PR" }] : [],
          error: null,
        }),
        range: async (from: number, to: number) => {
          if (table !== "technicians") return { data: [], error: null };
          if (coverageIds) state.coverageReads++;
          else state.baseReads++;
          const matches = state.candidates.filter(row => {
            if (requestedUf && row.state_uf !== requestedUf) return false;
            if (requestedCity && !String(row.city).toLowerCase().includes(requestedCity)) return false;
            if (coverageIds && !(row.coverage_city_ids as number[]).some(id => coverageIds!.includes(id))) return false;
            return true;
          });
          return { data: matches.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
    rpc: async (name: string, args?: { _ids?: string[] }) => ({
      data: name === "eut_public_eligible_technician_ids"
        ? (args?._ids ?? []).filter(id => !state.blockedIds.has(id))
          .map(technician_id => ({ technician_id }))
        : [],
      error: null,
    }),
  }),
}));
import { listApprovedTechnicians } from "./technicians.functions";

const make = (n: number, city: string, uf: string, covered: number[] = []) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  public_slug: `profissional-${n}`,
  display_name: `Profissional ${n}`,
  city, state_uf: uf, neighborhood: null, region: null, bio: null, avatar_path: null,
  service_radius_km: null, coverage_city_ids: covered, specialties: [], service_slugs: [],
});

const search = (page = 1) => ({ data: {
  especialidade: "Todas", cidade: "Curitiba", uf: "PR", regiao: "",
  servico: "", bairro: "", prioridade: "", pagina: page,
}});

beforeEach(() => {
  state.candidates = [
    make(1, "Curitiba", "PR"),
    make(2, "Campinas", "SP", [4106902]),
    make(3, "Florianópolis", "SC"),
  ];
  state.blockedIds.clear();
  state.baseReads = 0;
  state.coverageReads = 0;
  state.municipalityReads = 0;
});

describe("busca municipal por cidade-base e cobertura declarada", () => {
  it("inclui profissional com base em outra UF somente quando cobre a cidade consultada", async () => {
    const result = await listApprovedTechnicians(search());
    expect(result.map(row => row.id)).toEqual([make(1, "", "").id, make(2, "", "").id]);
    expect(state.baseReads).toBeGreaterThan(0);
    expect(state.coverageReads).toBeGreaterThan(0);
    expect(state.municipalityReads).toBe(1);
    expect(result.every(row => !("phone" in row) && !("email" in row))).toBe(true);
  });

  it("aplica elegibilidade e pagina depois de consolidar as duas consultas", async () => {
    state.candidates = Array.from({ length: 105 }, (_, index) => make(index + 10, "Curitiba", "PR"));
    state.candidates.push(make(999, "Campinas", "SP", [4106902]));
    state.blockedIds.add(make(10, "", "").id);
    const first = await listApprovedTechnicians(search());
    const second = await listApprovedTechnicians(search(2));
    expect(first).toHaveLength(100);
    expect(second).toHaveLength(5);
    expect([...first, ...second].some(row => row.id === make(999, "", "").id)).toBe(true);
    expect([...first, ...second].some(row => row.id === make(10, "", "").id)).toBe(false);
    expect(new Set([...first, ...second].map(row => row.id)).size).toBe(105);
  });
});
