// @vitest-environment jsdom
import { createElement } from "react";
import { render, waitFor } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { AdminNavigation } from "../components/admin-navigation";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ADMIN_SECTIONS, adminModulePath, adminModuleTitle, validAdminModule,
} from "./admin-sections";

const read = (path: string) => readFileSync(path, "utf8");

describe("Central administrativa: URLs próprias e RLS intacta", () => {
  it("oferece doze seções únicas, uma home e onze módulos reais", () => {
    expect(ADMIN_SECTIONS.map((x) => x.key)).toEqual([
      "inicio", "tecnicos", "clientes", "contas", "contatos", "solicitacoes",
      "patrocinadores", "mensagens", "catalogo",
      "legado", "reivindicacoes", "metricas",
    ]);
    expect(new Set(ADMIN_SECTIONS.map((x) => x.key)).size).toBe(12);
    expect(adminModulePath("inicio")).toBe("/admin");
    for (const entry of ADMIN_SECTIONS.filter((x) => x.key !== "inicio")) {
      expect(validAdminModule(entry.key)).toBe(true);
      expect(adminModulePath(entry.key)).toBe("/admin/" + entry.key);
      expect(adminModuleTitle(entry.key)).toBe(entry.label);
    }
  });
  it("bloqueia deep links desconhecidos antes de renderizar o painel", () => {
    for (const malicious of ["", "inicio", "../admin", "admin", "usuarios", "__proto__", "tecnicos?auth=1"]) {
      expect(validAdminModule(malicious)).toBe(false);
    }
    const route = read("src/routes/admin_.$secao.tsx");
    expect(route).toContain("validAdminModule(params.secao)");
    expect(route).toContain("throw notFound()");
    expect(route).toContain('name: "robots", content: "noindex, nofollow"');
  });
  it("protege cada página pelo papel do servidor e evita novo login em erro de roles", () => {
    const page = read("src/routes/admin.tsx");
    const nav = read("src/components/admin-navigation.tsx");
    expect(page).toContain('roles.includes("admin")');
    expect(page).toContain("rolesError");
    expect(page).toContain("refreshRoles()");
    expect(page).toContain('section === "tecnicos"');
    expect(page).toContain('section === "clientes"');
    expect(page).toContain('section === "patrocinadores"');
    expect(page).toContain('section === "metricas"');
    expect(page).toContain('section === "reivindicacoes"');
    expect(nav).toContain('aria-label="Menu administrativo"');
    expect(nav).toContain('to="/admin/$secao"');
    expect(nav).toContain('aria-current={chosen ? "page" : undefined}');
  });
  it("preserva fluxos privados reais e não inventa remoção/banimento de contas", () => {
    const page = read("src/routes/admin.tsx");
    for (const source of [
      "<AdminAdvertisingManager />", "<EutAdminManager />",
      "<LegacyReviewQueue />", "<LegacyClaimReview />",
      "<SearchMetrics />", "contact_messages",
      '<AdminTechnicianManager adminOwnerId={user.id} />',
    ]) expect(page).toContain(source);
    expect(page).not.toContain("auth.admin.deleteUser");
    expect(page).not.toContain("service_role");
    expect(page).toContain('<AdminAccountsManager initialFilter="clientes" />');
    expect(page).toContain('section === "contas"');
  });
  it("oferece atalhos operacionais autenticados sem alterar os guardas de acesso", () => {
    const page = read("src/routes/admin.tsx");
    const roleGate = page.indexOf('roles.includes("admin")');
    const authenticatedContent = page.indexOf('<ConnectedGoogleIdentity user={user} />');
    const shortcuts = page.indexOf('aria-label="Atalhos rápidos da administração"');
    expect(roleGate).toBeGreaterThanOrEqual(0);
    expect(authenticatedContent).toBeGreaterThan(roleGate);
    expect(shortcuts).toBeGreaterThan(authenticatedContent);
    for (const module of ["tecnicos", "solicitacoes", "contas", "contatos"]) {
      expect(page).toContain('{ section: "' + module + '"');
      expect(validAdminModule(module)).toBe(true);
    }
    expect(page).toContain('params={{ secao: item.section }}');
    expect(page).toContain('aria-current={section === item.section ? "page" : undefined}');
    expect(page).toContain('noindex, nofollow');
  });

});


describe("Menu administrativo: aria-current em rota exata", () => {
  for (const viewportWidth of [390, 1440]) {
    for (const [pathname, expectedHref] of [
      ["/admin", "/admin"],
      ["/admin/tecnicos", "/admin/tecnicos"],
    ] as const) {
      it("mantém somente a seção atual no menu em " + viewportWidth + "px, rota " + pathname, async () => {
        const originalWidth = window.innerWidth;
        Object.defineProperty(window, "innerWidth", { configurable: true, value: viewportWidth });
        const root = createRootRoute({ component: Outlet });
        const home = createRoute({
          getParentRoute: () => root,
          path: "/admin",
          component: () => createElement(AdminNavigation, { active: "inicio" }),
        });
        const technicians = createRoute({
          getParentRoute: () => root,
          path: "/admin/$secao",
          component: () => createElement(AdminNavigation, { active: "tecnicos" }),
        });
        const router = createRouter({
          routeTree: root.addChildren([home, technicians]),
          history: createMemoryHistory({ initialEntries: [pathname] }),
        });
        const view = render(createElement(RouterProvider, { router }));
        try {
          await waitFor(() => {
            const menu = view.container.querySelector('nav[aria-label="Menu administrativo"]');
            expect(menu).not.toBeNull();
            const current = Array.from(menu!.querySelectorAll('a[aria-current="page"]'));
            expect(current).toHaveLength(1);
            expect(current[0].getAttribute("href")).toBe(expectedHref);
          });
        } finally {
          view.unmount();
          Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
        }
      });
    }
  }
});
