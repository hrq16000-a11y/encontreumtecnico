import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    in: vi.fn(),
  };
  query.select.mockImplementation(() => query);
  query.eq.mockImplementation(() => query);
  query.in.mockResolvedValue({ data: [], error: null });
  const client = {
    from: vi.fn(() => query),
    rpc: vi.fn(),
  };
  return { query, client };
});

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: (fn: (...args: never[]) => unknown) => fn,
    }),
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mocks.client,
}));

import { getApprovedTechnician } from "./technicians.functions";

const id = "12345678-1234-4234-8234-123456789abc";

beforeEach(() => {
  mocks.query.select.mockClear();
  mocks.query.eq.mockClear();
  mocks.query.maybeSingle.mockReset();
  mocks.query.in.mockResolvedValue({ data: [], error: null });
  mocks.client.from.mockClear();
  mocks.client.rpc.mockReset();
});

describe("public technician profile lookup", () => {
  it("returns null only for a confirmed no-match", async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getApprovedTechnician({ data: { id } })).toBeNull();
    expect(mocks.query.eq).toHaveBeenCalledWith("status", "aprovado");
    expect(mocks.query.eq).toHaveBeenCalledWith("id", id);
  });

  it("resolves a published profile by its human-readable slug", async () => {
    const public_slug = "tecnico-de-exemplo-curitiba-pr";
    mocks.query.maybeSingle.mockResolvedValue({ data: { id, public_slug, display_name: "Exemplo", city: "Curitiba", state_uf: "PR", specialties: [], service_slugs: [], neighborhood: null, region: null, bio: null }, error: null });
    mocks.client.rpc.mockResolvedValue({ data: [], error: null });
    const result = await getApprovedTechnician({ data: { id: public_slug } });
    expect(mocks.query.eq).toHaveBeenCalledWith("public_slug", public_slug);
    expect(result?.id).toBe(id);
    expect(result?.public_slug).toBe(public_slug);
  });

  it("does not query Supabase for malicious or malformed slugs", async () => {
    expect(await getApprovedTechnician({ data: { id: "../admin" } })).toBeNull();
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it("does not claim that a profile is absent when the query fails", async () => {
    mocks.query.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST999", message: "temporary database failure" },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(getApprovedTechnician({ data: { id } }))
        .rejects.toThrow("Não foi possível consultar o perfil do técnico.");
      expect(log).toHaveBeenCalledWith("getApprovedTechnician lookup failed", "PGRST999");
    } finally {
      log.mockRestore();
    }
  });

  it("returns only public fields when an approved profile exists", async () => {
    const profile = {
      id,
      public_slug: "tecnico-de-exemplo-curitiba-pr",
      display_name: "Técnico de exemplo",
      specialties: ["computadores"],
      service_slugs: ["formatacao"],
      state_uf: "PR",
      city: "Curitiba",
      neighborhood: "Centro",
      region: null,
      bio: null,
    };
    mocks.query.maybeSingle.mockResolvedValue({ data: profile, error: null });
    mocks.client.rpc.mockResolvedValue({ data: [], error: null });
    const result = await getApprovedTechnician({ data: { id } });
    expect(result).toEqual({ ...profile, online_now: false, pioneer_bronze: false, referral_highlight: false, coverage_cities: [] });
    const selectedFields = String(mocks.query.select.mock.calls[0]?.[0]);
    expect(selectedFields).not.toMatch(/phone|email|contact|password/i);
  });
});
