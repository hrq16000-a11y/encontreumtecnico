import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  TECHNICIAN_PANEL_TABS, technicianTabFromHash,
  technicianTabHref,
} from "./technician-panel-navigation";

describe("Painel técnico navegável: abas profundas sem acessar dados de outro papel", () => {
  it("define oito destinos únicos para as funcionalidades existentes", () => {
    expect(TECHNICIAN_PANEL_TABS.map((tab) => tab.key)).toEqual([
      "inicio", "perfil", "cobertura", "foto",
      "solicitacoes", "indicacoes", "configuracoes", "recuperacao",
    ]);
    expect(new Set(TECHNICIAN_PANEL_TABS.map((tab) => tab.key)).size).toBe(8);
    for (const tab of TECHNICIAN_PANEL_TABS) {
      expect(technicianTabFromHash(technicianTabHref(tab.key))).toBe(tab.key);
      expect(technicianTabHref(tab.key)).toBe("#eut-tecnico-" + tab.key);
    }
  });
  it("desconhecidos e hashes maliciosos voltam para visão geral", () => {
    for (const hash of ["", "#", "#solicitacoes", "#eut-tecnico-admin", "#eut-tecnico-../admin", "#access_token=secret"]) {
      expect(technicianTabFromHash(hash)).toBe("inicio");
    }
  });
  it("mantém permissões de técnico e recuperação de erro sem obrigar outro login", () => {
    const source = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(source).toContain('roles.includes("tecnico")');
    expect(source).toContain("rolesError");
    expect(source).toContain("refreshRoles()");
    expect(source).toContain('panelTab === "perfil"');
    expect(source).toContain('panelTab === "cobertura"');
    expect(source).toContain('panelTab === "foto"');
    expect(source).toContain('panelTab === "solicitacoes"');
    expect(source).toContain('panelTab === "indicacoes"');
    expect(source).toContain('panelTab === "configuracoes"');
    expect(source).toContain('panelTab === "recuperacao"');
    expect(source).toContain('onClick={() => setPanelTab("perfil")}');
    expect(source).toContain("TechnicianPanelNavigation");
    expect(source).not.toContain("service_role");
  });
  it("preserva solicitações privadas por escolha expressa do cliente", () => {
    const source = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    expect(source).toContain('<TechnicianDirectRequests userId={user.id} />');
    expect(source).toContain('<TechnicianPrivateContact userId={user.id} />');
    expect(source).toContain('<PioneerPhoneVerification userId={user.id} />');
    expect(source).toContain('<TechnicianCoverageEditor userId={user.id}');
    expect(source).toContain('<TechnicianAvatarEditor userId={user.id}');
    expect(source).toContain('<LegacyAccountActivation userId={user.id} role="tecnico" />');
    const nav = readFileSync("src/components/technician-panel-navigation.tsx", "utf8");
    expect(nav).toContain('aria-label="Navegação do painel do técnico"');
    expect(nav).toContain('aria-current={selected ? "page" : undefined}');
    expect(nav).toContain("overflow-x-auto");
  });
});
