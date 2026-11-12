import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { decideTechnicianDraftRecovery } from "./technician-draft-recovery-decision";
import type { TechnicianDraftFields, DurableDraftRecord } from "./staged-technician-durable-draft";

const form: TechnicianDraftFields = {
  display_name: "Técnico de QA", state_uf: "PR", city: "São José dos Pinhais",
  neighborhood: "Jardim Itália", region: "", bio: "",
  specialties: ["computadores"], service_slugs: ["manutencao-pc"],
  base_city_ibge_id: 4125506,
};
const local = { form, step: 2 };
const durable: DurableDraftRecord = {
  form, step: 2, revision: 3,
  expiresAt: "2099-11-12T10:10:10Z",
};
const base = { ownerVerified: true, profileAlreadyPublished: false, local };

describe("P0 drafts: safe recovery decision (not imported in production wizard)", () => {
  it("restores same owner local draft while backend is unavailable", () => {
    expect(decideTechnicianDraftRecovery({ ...base, remote: { status: "unavailable" } }))
      .toMatchObject({ kind: "local", degraded: true });
    expect(decideTechnicianDraftRecovery({ ...base, remote: { status: "failed" } }))
      .toMatchObject({ kind: "local", degraded: true });
    expect(decideTechnicianDraftRecovery({ ...base, remote: { status: "missing" } }))
      .toMatchObject({ kind: "local", degraded: false });
  });
  it("denies restoration without verified owner, or once profile is published", () => {
    expect(decideTechnicianDraftRecovery({
      ...base, ownerVerified: false, remote: { status: "ok", value: durable },
    })).toEqual({ kind: "none" });
    expect(decideTechnicianDraftRecovery({
      ...base, profileAlreadyPublished: true, remote: { status: "ok", value: durable },
    })).toEqual({ kind: "none" });
  });
  it("accepts a durable copy only if local is missing or identical", () => {
    expect(decideTechnicianDraftRecovery({
      ...base, local: null, remote: { status: "ok", value: durable },
    }).kind).toBe("durable");
    expect(decideTechnicianDraftRecovery({
      ...base, remote: { status: "ok", value: durable },
    }).kind).toBe("durable");
  });
  it("does not overwrite Jardim Itália or pending local edits on conflict", () => {
    const altered = { ...durable, form: { ...form, neighborhood: "Centro" } };
    const decision = decideTechnicianDraftRecovery({
      ...base, remote: { status: "ok", value: altered },
    });
    expect(decision.kind).toBe("review_both");
    if (decision.kind === "review_both") {
      expect(decision.local.form.neighborhood).toBe("Jardim Itália");
      expect(decision.durable.form.neighborhood).toBe("Centro");
      expect(decision.durable.revision).toBe(3);
    }
  });
  it("keeps production wizard independent until real backend migration and QA", () => {
    const route = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(route).not.toContain("technician-draft-recovery-decision");
    expect(route).not.toContain("staged-technician-durable-draft");
  });
});
