import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { clearAdminPublicDraft, readAdminPublicDraft, saveAdminPublicDraft } from "./admin-public-profile-draft";

const original = { display_name: "Maria Técnica", bio: "Especialista em manutenção de notebooks.", region: "Curitiba" };
const edited = { ...original, bio: original.bio + " Atende redes domésticas." };
beforeEach(() => sessionStorage.clear());

describe("administrative public profile draft: owner and record isolation", () => {
  it("restores only on explicit edit and clears only after confirmed save or cancel", () => {
    const component = readFileSync("src/components/admin-technician-manager.tsx", "utf8");
    const page = readFileSync("src/routes/admin.tsx", "utf8");
    expect(page).toContain("<AdminTechnicianManager adminOwnerId={user.id} />");
    expect(component).toContain("readAdminPublicDraft(adminOwnerId, technician.id, baseline)");
    expect(component).toContain("saveAdminPublicDraft(adminOwnerId, target.technician.id, baseline, next)");
    expect(component).toContain('if (target.action === "editar") clearAdminPublicDraft(adminOwnerId, target.technician.id)');
    expect(component).toContain("Servidor não confirmou a atualização solicitada.");
    expect(component).toContain("setReason(\\"\\")".replaceAll("\\\\", "\\"));
    expect(component).not.toContain("saveAdminPublicDraft(adminOwnerId, target.technician.id, baseline, reason)");
  });

  it("recovers unsent public bio only for the same operator, technician and server baseline", () => {
    expect(saveAdminPublicDraft("admin-1", "tech-1", original, edited)).toBe(true);
    expect(readAdminPublicDraft("admin-1", "tech-1", original)).toEqual(edited);
    expect(readAdminPublicDraft("admin-2", "tech-1", original)).toBeNull();
    expect(readAdminPublicDraft("admin-1", "tech-2", original)).toBeNull();
    expect(readAdminPublicDraft("admin-1", "tech-1", { ...original, bio: "Edited by someone else" })).toBeNull();
    expect(localStorage.length).toBe(0);
  });
  it("expires after 15 minutes, clears only the confirmed edited record", () => {
    saveAdminPublicDraft("admin-1", "tech-1", original, edited, sessionStorage, 100000);
    saveAdminPublicDraft("admin-1", "tech-2", original, edited, sessionStorage);
    expect(readAdminPublicDraft("admin-1", "tech-1", original, sessionStorage, 100000 + 16 * 60 * 1000)).toBeNull();
    clearAdminPublicDraft("admin-1", "tech-1");
    expect(readAdminPublicDraft("admin-1", "tech-1", original)).toBeNull();
    expect(readAdminPublicDraft("admin-1", "tech-2", original)).toEqual(edited);
  });
  it("rejects phone, e-mail, contact redirects, oversized text and invalid owner IDs", () => {
    expect(saveAdminPublicDraft("admin-1", "tech-1", original, { ...edited, bio: "Ligue no WhatsApp para agendar" })).toBe(false);
    expect(saveAdminPublicDraft("admin-1", "tech-1", original, { ...edited, bio: "email@dominio.com" })).toBe(false);
    expect(saveAdminPublicDraft("admin-1", "tech-1", original, { ...edited, bio: "texto".repeat(400) })).toBe(false);
    expect(saveAdminPublicDraft("admin/1", "tech-1", original, edited)).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });
  it("does not persist moderation reason, phone, e-mail, privileges or payment details", () => {
    expect(saveAdminPublicDraft("admin-1", "tech-1", original, edited)).toBe(true);
    const stored = sessionStorage.getItem("eut-admin-public-edit-v1:admin-1:tech-1") ?? "";
    expect(stored).not.toMatch(/motivo administrativo|p_reason|contact_phone|email|access_token|password|payment|ban_account|phone/i);
  });
});
