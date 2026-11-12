import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createStagedTechnicianDraftAdapter, validateDraftPayload,
  type TechnicianDraftFields,
} from "./staged-technician-durable-draft";

const OWNER = "00000000-0000-4000-8000-000000000011";
const OTHER = "00000000-0000-4000-8000-000000000012";
const form: TechnicianDraftFields = {
  display_name: "Técnico QA", state_uf: "PR", city: "São José dos Pinhais",
  neighborhood: "Jardim Itália", region: "", bio: "",
  specialties: ["computadores"], service_slugs: ["manutencao-pc"],
  base_city_ibge_id: 4125506,
};
const future = new Date(Date.now() + 86400000).toISOString();
const row = { owner_id: OWNER, draft: form, step: 2, revision: 3, expires_at: future };

function fakeClient(response: { data: unknown; error: { code: string } | null } =
  { data: row, error: null }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let result = response;
  const query: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "eq", "gt", "insert", "update", "delete"]) {
    query[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return query;
    };
  }
  query["maybeSingle"] = () => Promise.resolve(result);
  const from = vi.fn((_table: string) => query);
  return {
    client: { from } as unknown as SupabaseClient,
    from, calls, respond(next: typeof response) { result = next; },
  };
}
describe("Adapter staged durable draft: never active before backend QA", () => {
  it("does not query Supabase when backend is not verified", async () => {
    const fake = fakeClient();
    const adapter = createStagedTechnicianDraftAdapter(fake.client);
    expect((await adapter.load(OWNER)).status).toBe("unavailable");
    expect((await adapter.save(OWNER, form, 1, null)).status).toBe("unavailable");
    expect(await adapter.clearAfterConfirmedPublication(OWNER, true, 3)).toBe(false);
    expect(fake.from).not.toHaveBeenCalled();
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(route).not.toContain("staged-technician-durable-draft");
  });
  it("sends only allowlisted fields, preserves Jardim Itália and ID IBGE", async () => {
    const fake = fakeClient({ data: { ...row, revision: 1 }, error: null });
    const adapter = createStagedTechnicianDraftAdapter(fake.client, true);
    expect((await adapter.save(OWNER, form, 2, null)).status).toBe("ok");
    expect(fake.from).toHaveBeenCalledWith("eut_technician_drafts");
    const insert = fake.calls.find(x => x.method === "insert");
    const body = insert?.args[0] as Record<string, unknown>;
    expect(body["owner_id"]).toBe(OWNER);
    expect(body["step"]).toBe(2);
    expect((body["draft"] as TechnicianDraftFields).neighborhood).toBe("Jardim Itália");
    expect((body["draft"] as TechnicianDraftFields).base_city_ibge_id).toBe(4125506);
    expect(Object.keys(body["draft"] as object).sort()).toEqual(Object.keys(form).sort());
    expect(Object.keys(body)).not.toContain("allow_paid_contact");
  });
  it("accepts a read only when owner matches and TTL is not expired", async () => {
    const fake = fakeClient();
    const adapter = createStagedTechnicianDraftAdapter(fake.client, true);
    const ok = await adapter.load(OWNER);
    expect(ok.status).toBe("ok");
    if (ok.status === "ok") expect(ok.value.revision).toBe(3);
    expect(fake.calls.filter(x => x.method === "gt").length).toBe(1);
    fake.respond({ data: { ...row, owner_id: OTHER }, error: null });
    expect((await adapter.load(OWNER)).status).toBe("invalid");
    fake.respond({ data: { ...row, expires_at: new Date(Date.now() - 1000).toISOString() }, error: null });
    expect((await adapter.load(OWNER)).status).toBe("invalid");
  });
  it("refuses unwanted contact, token, invalid slugs and owner IDs", async () => {
    expect(validateDraftPayload({ ...form, bio: "Contato 41999998888" })).toBeNull();
    expect(validateDraftPayload({ ...form, city: "teste@example.com" })).toBeNull();
    expect(validateDraftPayload({ ...form, region: "https://example.com" })).toBeNull();
    expect(validateDraftPayload({ ...form, service_slugs: ["meu-contato@example.com"] })).toBeNull();
    expect(validateDraftPayload({ ...form, access_token: "nope" } as TechnicianDraftFields)).toBeNull();
    const fake = fakeClient();
    expect((await createStagedTechnicianDraftAdapter(fake.client, true)
      .save("not-a-uuid", form, 3, null)).status).toBe("invalid");
    expect(fake.from).not.toHaveBeenCalled();
  });
  it("treats optimistic write returning zero rows and duplicate key as conflicts", async () => {
    const fake = fakeClient({ data: null, error: null });
    const adapter = createStagedTechnicianDraftAdapter(fake.client, true);
    expect((await adapter.save(OWNER, form, 3, 3)).status).toBe("conflict");
    expect(fake.calls.filter(x => x.method === "eq").map(x => x.args)).toContainEqual(["revision", 3]);
    fake.respond({ data: null, error: { code: "23505" } });
    expect((await adapter.save(OWNER, form, 3, null)).status).toBe("conflict");
  });
  it("clears only after confirmed owner publication", async () => {
    const fake = fakeClient({ data: { owner_id: OWNER }, error: null });
    const adapter = createStagedTechnicianDraftAdapter(fake.client, true);
    expect(await adapter.clearAfterConfirmedPublication(OWNER, false, 3)).toBe(false);
    expect(fake.from).not.toHaveBeenCalled();
    expect(await adapter.clearAfterConfirmedPublication(OWNER, true, 3)).toBe(true);
    expect(fake.calls.some(c => c.method === "delete")).toBe(true);
    expect(fake.calls.some(c => c.method === "eq" && c.args[0] === "owner_id" &&
      c.args[1] === OWNER)).toBe(true);
    expect(fake.calls.some(c => c.method === "eq" && c.args[0] === "revision" &&
      c.args[1] === 3)).toBe(true);
  });
  it("never deletes a draft without known pre-publication revision", async () => {
    const fake = fakeClient({ data: null, error: null });
    const adapter = createStagedTechnicianDraftAdapter(fake.client, true);
    expect(await adapter.clearAfterConfirmedPublication(OWNER, true, 0)).toBe(false);
    expect(await adapter.clearAfterConfirmedPublication(OWNER, true, Number.NaN)).toBe(false);
    expect(fake.from).not.toHaveBeenCalled();
    // Simulate server returning zero rows: newer revision must survive.
    expect(await adapter.clearAfterConfirmedPublication(OWNER, true, 3)).toBe(false);
    expect(fake.calls.some(c => c.method === "eq" && c.args[0] === "revision" &&
      c.args[1] === 3)).toBe(true);
  });
});
