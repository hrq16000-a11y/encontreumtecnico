import { describe, expect, it } from "vitest";
import { isStandaloneVisualRoute } from "./shared-shell-routing";

describe("navigation shell route isolation", () => {
  it("keeps normal pages inside a single persistent frame", () => {
    for (const route of ["/", "/contato", "/tecnicos", "/entrar", "/cadastro", "/admin", "/area-cliente", "/area-tecnico", "/acesso-contato/uuid"])
      expect(isStandaloneVisualRoute(route)).toBe(false);
  });
  it("does not wrap LP2 and Home2 with the original visual shell", () => {
    for (const route of ["/home2", "/lp2", "/lp2/", "/lp2/galeria", "/lp2/entrar"])
      expect(isStandaloneVisualRoute(route)).toBe(true);
    expect(isStandaloneVisualRoute("/lp20")).toBe(false);
  });
});
