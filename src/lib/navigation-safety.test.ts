import { describe, expect, it } from "vitest";
import { accountLanding, isTechnicianDetailPath, safeLoginDestination, showMobileQuickTabs } from "./navigation-safety";

describe("Navegação segura por papel e contexto", () => {
  it("leva cada conta à área correta, sem adivinhar privilégio", () => {
    expect(accountLanding(["admin"])).toBe("/admin");
    expect(accountLanding(["tecnico"])).toBe("/area-tecnico");
    expect(accountLanding(["cliente"])).toBe("/area-cliente");
    expect(accountLanding([])).toBe("/entrar");
  });

  it("não envia um cliente para painel de técnico nem aproveita redirecionamentos externos", () => {
    expect(safeLoginDestination("/area-tecnico", ["cliente"])).toBe("/area-cliente");
    expect(safeLoginDestination("/admin", ["tecnico"])).toBe("/area-tecnico");
    expect(safeLoginDestination("//example.org", ["cliente"])).toBe("/area-cliente");
    expect(safeLoginDestination("/\\example.org", ["cliente"])).toBe("/area-cliente");
    expect(safeLoginDestination("/tecnicos/nao-existe?x=1", ["cliente"])).toBe("/tecnicos/nao-existe");
    expect(safeLoginDestination("/entrar", ["tecnico"])).toBe("/area-tecnico");
  });

  it("preserva recuperação histórica verificada e solicitação com UUID interno", () => {
    expect(safeLoginDestination("/reivindicar-cadastro?wp=4415", ["tecnico"])).toBe("/reivindicar-cadastro?wp=4415");
    expect(safeLoginDestination("/reivindicar-cadastro?wp=4415&next=//evil", ["tecnico"])).toBe("/area-tecnico");
    const uuid = "b190db33-86e1-4cf4-b916-a1f4eac56720";
    expect(safeLoginDestination("/area-cliente?tecnico=" + uuid, ["cliente"])).toBe("/area-cliente?tecnico=" + uuid);
    expect(safeLoginDestination("/area-cliente?tecnico=" + uuid, ["tecnico"])).toBe("/area-tecnico");
  });

  it("reserva espaço livre para formulário e barra de ação própria no celular", () => {
    expect(showMobileQuickTabs("/")).toBe(true);
    expect(showMobileQuickTabs("/tecnicos")).toBe(true);
    for (const path of ["/area-cliente", "/area-tecnico", "/admin", "/entrar",
      "/cadastro", "/acesso-contato/id", "/reivindicar-cadastro", "/tecnicos/jefferson-santana-tubarao-sc"]) {
      expect(showMobileQuickTabs(path), path).toBe(false);
    }
    expect(isTechnicianDetailPath("/tecnicos/")).toBe(false);
    expect(isTechnicianDetailPath("/tecnicos/jefferson-santana-tubarao-sc")).toBe(true);
  });
});
