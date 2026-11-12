import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { readUiTextDraft, saveUiTextDraft } from "./unsent-ui-draft";
import { readProtectedDraft, saveProtectedDraft } from "./protected-session-draft";

const source = (path: string) => readFileSync(path, "utf8");

describe("SSR-safe draft restoration and visibility", () => {
  it("does not read tab storage during the initial public search render", () => {
    for (const [file, slot] of [
      ["src/routes/index.tsx", "home"],
      ["src/routes/home2.tsx", "home2"],
      ["src/routes/lp2/index.tsx", "lp2-home"],
      ["src/routes/lp2/galeria.tsx", "lp2-gallery"],
      ["src/components/problem-assistant.tsx", "problem"],
    ] as const) {
      const code = source(file);
      expect(code, file).toContain("setDraftReady(true)");
      expect(code, file).toContain("aria-busy");
      expect(code, file).not.toMatch(/useState\(\s*\(\)\s*=>\s*readUiTextDraft/);
      // Returning visitors get an accessible recovery status, not empty editable fields.
      expect(code, file).toMatch(/draftReady\s*\?/);
      expect(code, file).toContain('readUiTextDraft("' + slot + '")');
    }
  });

  it("does not render private editors before verifying their account's draft", () => {
    const client = source("src/routes/area-cliente.tsx");
    const technician = source("src/routes/area-tecnico.tsx");
    expect(client).toContain("draftRestoredOwnerId !== user.id");
    expect(technician).toContain("draftRestoredOwnerId !== user.id");
    for (const code of [client, technician]) {
      expect(code).toContain("setDraftRestoredOwnerId(user.id)");
      expect(code).toContain("setDraftRestoredOwnerId(null)");
      expect(code).toContain("aria-busy");
      expect(code).not.toContain("localStorage.setItem");
    }
    expect(client).toContain('readProtectedDraft<ClientRequestDraft>("cliente", user.id)');
    expect(technician).toContain('readProtectedDraft<typeof form>("tecnico", user.id)');
  });
});

describe("returning browser tab and account ownership", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps the public input for the tab and never treats it as account-private data", () => {
    expect(saveUiTextDraft("home2", { query: "redes", city: "São José dos Pinhais" })).toBe(true);
    expect(readUiTextDraft("home2")).toEqual({ query: "redes", city: "São José dos Pinhais" });
    expect(readProtectedDraft("cliente", "account-a")).toBeNull();
    expect(readProtectedDraft("tecnico", "account-a")).toBeNull();
  });

  it("restores two private roles independently and never crosses account identities", () => {
    const client = { title: "Problema de notebook", description: "Não liga", category: "computadores", city: "Curitiba", region: "" };
    const technician = { display_name: "Profissional", bio: "Manutenção", city: "Curitiba", state_uf: "PR" };
    expect(saveProtectedDraft("cliente", "account-a", client, 2)).toBe(true);
    expect(saveProtectedDraft("tecnico", "account-a", technician, 3)).toBe(true);
    expect(readProtectedDraft<typeof client>("cliente", "account-a")).toEqual({ form: client, step: 2 });
    expect(readProtectedDraft<typeof technician>("tecnico", "account-a")).toEqual({ form: technician, step: 3 });
    expect(readProtectedDraft("cliente", "account-b")).toBeNull();
    expect(readProtectedDraft("tecnico", "account-b")).toBeNull();
  });
});
