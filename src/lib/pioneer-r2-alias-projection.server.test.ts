import { describe, expect, it, vi } from "vitest";
import { collectR2EligibleWordPressAliasHints, type R2AliasCandidate } from "./pioneer-r2-alias-projection.server";

const wp = (id: string, patch: Partial<R2AliasCandidate> = {}): R2AliasCandidate => ({
  id,
  display_name: "almeidathiagosantos5",
  user_id: null,
  status: "pendente",
  catalog_enabled: true,
  catalog_origin: "wordpress",
  originalWordPressAlias: "almeidathiagosantos5",
  ...patch,
});

describe("server-only R2 alias projection (synthetic)", () => {
  it("calls R2 before emitting a hint and strips private/internal fields", async () => {
    const rpc = vi.fn(async () => ({ data: [{ technician_id: "eligible" }], error: null }));
    const candidate = { ...wp("eligible"), phone_e164: "+5511999998888", source_key: "wp:synthetic", audit_actor: "private" };
    const result = await collectR2EligibleWordPressAliasHints({ rpc }, [candidate]);
    expect(rpc).toHaveBeenCalledWith("eut_public_eligible_technician_ids", { _ids: ["eligible"] });
    expect(result).toEqual([{ id: "eligible", provenanceLinkedWordPressAlias: "almeidathiagosantos5" }]);
    expect(JSON.stringify(result)).not.toMatch(/phone|source_key|audit_actor|catalog_origin|user_id|5511999998888/);
  });

  it("never passes denied, disabled, no-phone or no-provenance candidates", async () => {
    const rows = [wp("eligible"), wp("no-phone"), wp("blocked"),
      wp("disabled", { catalog_enabled: false }), wp("no-provenance", { originalWordPressAlias: null })];
    const result = await collectR2EligibleWordPressAliasHints({
      rpc: async () => ({ data: [{ technician_id: "eligible" }], error: null }),
    }, rows);
    expect(result).toEqual([{ id: "eligible", provenanceLinkedWordPressAlias: "almeidathiagosantos5" }]);
  });

  it("refuses to guess an immutable alias after editing or missing source", async () => {
    const rows = [wp("edited", { display_name: "Almeida Thiago Santos" }),
      wp("lost", { originalWordPressAlias: null }),
      wp("organic", { catalog_origin: "organic_auth", user_id: "synthetic-user" }),
      wp("disabled", { catalog_enabled: false }),
      wp("wrong-status", { status: "aprovado" })];
    const result = await collectR2EligibleWordPressAliasHints({
      rpc: async () => ({ data: rows.map(r => ({ technician_id: r.id })), error: null }),
    }, rows);
    expect(result).toEqual(rows.map(row => ({ id: row.id, provenanceLinkedWordPressAlias: null })));
  });

  it("fails closed on an unavailable R2 RPC", async () => {
    await expect(collectR2EligibleWordPressAliasHints({
      rpc: async () => ({ data: null, error: { code: "offline" } }),
    }, [wp("eligible")])).rejects.toThrow("Public technician eligibility unavailable");
  });

  it("ignores extra IDs not present in the requested R2 batch", async () => {
    const result = await collectR2EligibleWordPressAliasHints({
      rpc: async () => ({ data: [{ technician_id: "other" }], error: null }),
    }, [wp("eligible")]);
    expect(result).toEqual([]);
  });
});
