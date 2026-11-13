import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isPublicVisualRoute } from "./public-visual-route";

describe("public visual comfort: route isolation and accessibility", () => {
  it.each(["/", "/tecnicos", "/tecnicos/uuid", "/tecnico/profissional",
    "/servicos/computadores", "/categorias/redes", "/cidades/pr/curitiba",
    "/galeria", "/guias/windows", "/cobertura", "/como-funciona", "/faq",
    "/ecossistema"])("allows public discovery at %s", path => {
    expect(isPublicVisualRoute(path)).toBe(true);
  });

  it.each(["/admin", "/admin/usuarios", "/area-tecnico", "/area-cliente",
    "/entrar", "/cadastro", "/redefinir-senha", "/acesso-contato/uuid",
    "/lista-de-tecnicos", "/lp2", "/home2", "/tecnicos-privado",
    "/tecnico-fake", "/servicos-admin", "/pagamentos-e-reembolsos"])
  ("does not restyle operational or protected routes at %s", path => {
    expect(isPublicVisualRoute(path)).toBe(false);
  });

  it("keeps public palette scoped and motion accessible", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    const shell = readFileSync("src/components/page-placeholder.tsx", "utf8");
    expect(css).toContain(":root:not(.dark) .eut-public-calm");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".eut-public-calm main :where(a, button):focus-visible");
    expect(root).toContain("publicVisual={isPublicVisualRoute(pathname)}");
    expect(shell).toContain('publicVisual ? " eut-public-calm" : ""');
    expect(css).not.toContain("http://fonts.");
  });
});
