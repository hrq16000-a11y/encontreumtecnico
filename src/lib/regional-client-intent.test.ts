import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { persistClientRequest } from "./client-request-save";
import { mayShareDirectRequest, regionalClientReturnPath, regionalRequestRecipient } from "./regional-client-intent";
import { safeLoginDestination } from "./navigation-safety";

const uuid = "b190db33-86e1-4cf4-b916-a1f4eac56720";

describe("Funil regional privado, sem cadastro fictício", () => {
  it("remove qualquer destinatário anterior, mesmo com consentimento antigo", async () => {
    const recipient = regionalRequestRecipient(true, uuid);
    const sharing = mayShareDirectRequest(true, true, recipient);
    expect(recipient).toBeNull();
    expect(sharing).toBe(false);
    const insert = vi.fn(async () => ({ error: null }));
    const share = vi.fn(async () => ({ data: { status: "enviado" }, error: null }));
    expect(await persistClientRequest(insert, sharing ? share : undefined)).toBe("stored_private");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(share).not.toHaveBeenCalled();
  });

  it("não muda o funil direto autorizado com um técnico legítimo", () => {
    expect(regionalRequestRecipient(false, uuid)).toBe(uuid);
    expect(mayShareDirectRequest(false, true, uuid)).toBe(true);
    expect(mayShareDirectRequest(false, false, uuid)).toBe(false);
    expect(mayShareDirectRequest(false, true, null)).toBe(false);
  });

  it("mantém o contexto regional após autenticação sem aceitar URL externa nem contato", () => {
    const path = regionalClientReturnPath("computadores");
    expect(path).toBe("/area-cliente?modo=regional&categoria=computadores");
    expect(safeLoginDestination(path, ["cliente"])).toBe(path);
    expect(safeLoginDestination(path, ["tecnico"])).toBe("/area-tecnico");
    expect(regionalClientReturnPath("https://malicious.invalid")).toBe("/area-cliente?modo=regional");
    expect(regionalClientReturnPath("foo&tecnico=" + uuid)).toBe("/area-cliente?modo=regional");
    expect(safeLoginDestination("/area-cliente?modo=regional&tecnico=" + uuid, ["cliente"]))
      .toBe("/area-cliente?modo=regional");
  });

  it("registra a intenção no catálogo sem exibir nome ou contato dos candidatos externos", () => {
    const route = readFileSync("src/routes/area-cliente.tsx", "utf8");
    const category = readFileSync("src/routes/servicos.$categoria.tsx", "utf8");
    expect(category).toContain('search={{ modo: "regional", categoria: category.slug }}');
    expect(category).toContain("Sou profissional — cadastrar gratuitamente");
    expect(route).toContain("technician_id: effectiveTechnicianTarget");
    expect(route).toContain("const shouldShare = directShare");
    expect(route).toContain("clearTechnicianTarget()");
    expect(route).toContain("Nenhum perfil externo não reivindicado");
    expect(route).toContain("eut-after-login");
    expect(route).toContain("if (!regionalRequest || !user || !roles.includes(\"cliente\")");
  });
});
