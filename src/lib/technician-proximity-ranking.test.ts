import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  headers: {} as Record<string, string>,
  catalogValid: true,
  catalogLookups: 0,
  profiles: [
    { id: "11111111-1111-4111-8111-111111111111", public_slug: "profissional-distante", display_name: "Profissional distante", city: "Tubarão", state_uf: "SC", neighborhood: null, region: null, bio: null, avatar_path: null, specialties: ["redes"], service_slugs: ["wifi"], service_radius_km: null, coverage_city_ids: [] },
    { id: "22222222-2222-4222-8222-222222222222", public_slug: "profissional-local", display_name: "Profissional local", city: "Curitiba", state_uf: "PR", neighborhood: null, region: null, bio: null, avatar_path: null, specialties: ["redes"], service_slugs: ["wifi"], service_radius_km: null, coverage_city_ids: [] },
  ],
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: () => ({ handler: (fn: (...args: never[]) => unknown) => fn }) }),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (key: string) => state.headers[key],
  setResponseHeader: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        ilike: () => query,
        order: () => query,
        limit: () => {
          if (table === "eut_ibge_municipalities") {
            state.catalogLookups++;
            return Promise.resolve({ data: state.catalogValid ? [{ id: 4106902 }] : [], error: null });
          }
          return Promise.resolve({ data: [], error: null });
        },
        range: () => query,
        then: (fulfilled: (result: { data: typeof state.profiles; error: null }) => unknown) =>
          Promise.resolve({ data: state.profiles, error: null }).then(fulfilled),
        in: () => Promise.resolve({ data: [], error: null }),
      };
      return query;
    },
    rpc: (name: string, args?: { _ids?: string[] }) => Promise.resolve({
      data: name === "eut_public_eligible_technician_ids"
        ? (args?._ids ?? []).map(technician_id => ({ technician_id })) : [],
      error: null,
    }),
  }),
}));

import { listApprovedTechnicians } from "./technicians.functions";

const query = (overrides: Partial<{ cidade: string; uf: string; bairro: string; regiao: string; prioridade: string }> = {}) => ({
  especialidade: "Todas", cidade: "", regiao: "", servico: "", uf: "", bairro: "", prioridade: "", pagina: 1,
  ...overrides,
});

beforeEach(() => {
  state.headers = { "x-vercel-ip-country": "BR", "x-vercel-ip-country-region": "PR", "x-vercel-ip-city": "Curitiba" };
  state.catalogValid = true;
  state.catalogLookups = 0;
});

describe("ordenação regional automática do diretório", () => {
  it("mostra primeiro o município aproximado válido sem expor IP ou exigir GPS", async () => {
    const results = await listApprovedTechnicians({ data: query() });
    expect(results.map(item => item.display_name)).toEqual(["Profissional local", "Profissional distante"]);
    expect(state.catalogLookups).toBe(1);
    expect(results.every(item => !("phone" in item) && !("email" in item))).toBe(true);
  });

  it("não força região quando a localização por IP é inválida ou não está no IBGE", async () => {
    state.catalogValid = false;
    expect((await listApprovedTechnicians({ data: query() }))[0]?.city).toBe("Tubarão");
    state.headers["x-vercel-ip-country"] = "US";
    state.catalogLookups = 0;
    expect((await listApprovedTechnicians({ data: query() }))[0]?.city).toBe("Tubarão");
    expect(state.catalogLookups).toBe(0);
  });

  it("respeita escolha manual de cidade/UF e nunca usa a dica de IP nesse caso", async () => {
    await listApprovedTechnicians({ data: query({ cidade: "Tubarão", uf: "SC" }) });
    expect(state.catalogLookups).toBe(0);
    const ranked = await listApprovedTechnicians({ data: query({ cidade: "Tubarão", uf: "SC", prioridade: "regiao" }) });
    expect(ranked[0]?.city).toBe("Tubarão");
    expect(state.catalogLookups).toBe(0);
  });
});
