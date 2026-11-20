import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  headers: {} as Record<string, string>,
  catalogValid: true,
  catalogLookups: 0,
  directorySettings: null as Record<string, boolean> | null,
  adminProfiles: [] as Array<Record<string, unknown>>,
  revokedIds: new Set<string>(),
  pageRanges: [] as Array<[number, number]>,
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
      let start = 0;
      let end = 99;
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
        contains: () => query,
        range: (from: number, to: number) => {
          start = from;
          end = to;
          if (table === "technicians") state.pageRanges.push([from, to]);
          return query;
        },
        then: (fulfilled: (result: { data: typeof state.profiles; error: null }) => unknown) =>
          Promise.resolve({ data: state.profiles.slice(start, end + 1), error: null }).then(fulfilled),
        in: () => Promise.resolve({ data: [], error: null }),
      };
      return query;
    },
    rpc: (name: string, args?: { _ids?: string[]; _offset?: number; _limit?: number }) => Promise.resolve({
      data: name === "eut_public_directory_settings" ? state.directorySettings
        : name === "eut_public_eligible_technician_ids"
        ? (args?._ids ?? []).filter(id => !state.revokedIds.has(id)).map(technician_id => ({ technician_id }))
        : name === "eut_public_admin_technicians"
          ? state.adminProfiles.slice(args?._offset ?? 0, (args?._offset ?? 0) + (args?._limit ?? 200)) : [],
      error: null,
    }),
  }),
}));

import { listApprovedTechnicians } from "./technicians.functions";
import { DEFAULT_DIRECTORY_DISPLAY } from "./directory-display-settings";

const baseProfiles = state.profiles.slice();
const uuid = (n: number) => {
  const hex = n.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
};
const profile = (n: number, city: string, state_uf: string) => ({
  ...baseProfiles[0]!, id: uuid(n), public_slug: `profissional-${n}`,
  display_name: `Profissional ${n}`, city, state_uf,
});
const adminProfile = (n: number, city: string, state_uf: string) => ({
  ...profile(n, city, state_uf), public_slug: `tecnico-${uuid(n).replace(/-/g, "")}`,
  covers_entire_state: false,
});

const query = (overrides: Partial<{ cidade: string; uf: string; bairro: string; regiao: string; prioridade: string }> = {}) => ({
  especialidade: "Todas", cidade: "", regiao: "", servico: "", uf: "", bairro: "", prioridade: "", pagina: 1,
  ...overrides,
});

beforeEach(() => {
  state.headers = { "x-vercel-ip-country": "BR", "x-vercel-ip-country-region": "PR", "x-vercel-ip-city": "Curitiba" };
  state.catalogValid = true;
  state.catalogLookups = 0;
  state.directorySettings = null;
  state.profiles = baseProfiles.slice();
  state.adminProfiles = [];
  state.revokedIds.clear();
  state.pageRanges = [];
});

describe("ordenação regional automática do diretório", () => {
  it("desativa a inferência regional somente quando o proprietário a configura", async () => {
    state.directorySettings = { ...DEFAULT_DIRECTORY_DISPLAY, auto_region: false };
    const result = await listApprovedTechnicians({ data: query() });
    expect(result[0]?.city).toBe("Tubarão");
    expect(state.catalogLookups).toBe(0);
    // A intenção explícita do usuário continua priorizada independentemente do controle automático.
    const explicit = await listApprovedTechnicians({ data: query({ cidade: "Curitiba", uf: "PR", prioridade: "regiao" }) });
    expect(explicit[0]?.city).toBe("Curitiba");
  });
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

  it("prioriza os técnicos de páginas posteriores antes de paginar os resultados globais", async () => {
    state.profiles = Array.from({ length: 505 }, (_, n) => profile(n + 10, "Tubarão", "SC"));
    const local = profile(990, "Curitiba", "PR");
    state.profiles.push(local); // 506º registro: só aparece depois do primeiro lote de 500.
    const first = await listApprovedTechnicians({ data: query() });
    expect(first).toHaveLength(100);
    expect(first[0]?.id).toBe(local.id);
    expect(state.pageRanges).toContainEqual([500, 999]);
    const second = await listApprovedTechnicians({ data: { ...query(), pagina: 2 } });
    expect(second).toHaveLength(100);
    expect(new Set([...first, ...second].map(item => item.id)).size).toBe(200);
    expect(second.some(item => item.id === local.id)).toBe(false);
  });

  it("inclui na mesma classificação os importados após o limite de 200 da RPC", async () => {
    state.profiles = [];
    state.adminProfiles = Array.from({ length: 203 }, (_, n) => adminProfile(n + 1000, "Tubarão", "SC"));
    const local = adminProfile(1300, "Curitiba", "PR");
    state.adminProfiles.push(local);
    const results = await listApprovedTechnicians({ data: query() });
    expect(results).toHaveLength(100);
    expect(results[0]?.id).toBe(local.id);
    expect(results.every(row => !('phone' in row) && !('email' in row))).toBe(true);
  });

  it("não promove um técnico revogado mesmo se for o único na cidade aproximada", async () => {
    const local = profile(2000, "Curitiba", "PR");
    state.profiles = [profile(2001, "Tubarão", "SC"), local];
    state.revokedIds.add(local.id);
    expect((await listApprovedTechnicians({ data: query() })).map(item => item.id))
      .toEqual([uuid(2001)]);
  });

  it("sem localização válida mantém a busca paginada sem varrer o catálogo", async () => {
    state.headers["x-vercel-ip-country"] = "US";
    state.profiles = Array.from({ length: 550 }, (_, n) => profile(n + 3000, "Tubarão", "SC"));
    const results = await listApprovedTechnicians({ data: { ...query(), pagina: 2 } });
    expect(results).toHaveLength(100);
    expect(state.pageRanges).toEqual([[100, 199]]);
  });
});
