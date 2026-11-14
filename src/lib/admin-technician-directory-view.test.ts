import { describe, expect, it } from "vitest";
import {
  canBulkAct,
  orderTechnicians,
  technicianState,
  type DirectoryActionRow,
} from "./admin-technician-directory-view";

const wp: DirectoryActionRow = { key: "wp:7", name: "Beta", origin: "wordpress", wpPostId: 7 };
const portal: DirectoryActionRow = {
  key: "portal:1",
  name: "Álvaro",
  origin: "portal",
  portalId: "1",
  portalStatus: "aprovado",
  createdAt: "2026-11-13T10:00:00Z",
  updatedAt: "2026-11-14T10:00:00Z",
};
const imported: DirectoryActionRow = {
  key: "registry:2",
  name: "Zeca",
  origin: "guiafix",
  registry: { archived: false, admin_active: false },
};

describe("visualização e operações em lote de técnicos", () => {
  it("ordena A–Z, Z–A e datas conhecidas sem inventar datas de acervo", () => {
    expect(orderTechnicians([wp, imported, portal], "name-asc").map((r) => r.key)).toEqual([
      "portal:1",
      "wp:7",
      "registry:2",
    ]);
    expect(orderTechnicians([wp, imported, portal], "name-desc").map((r) => r.key)).toEqual([
      "registry:2",
      "wp:7",
      "portal:1",
    ]);
    expect(orderTechnicians([wp, imported, portal], "newest")[0]?.key).toBe("portal:1");
  });

  it("permite importar referências e suspender contas, mantendo diferenças operacionais internas", () => {
    expect(canBulkAct(wp, "import")).toBe(true);
    expect(canBulkAct(portal, "archive")).toBe(true);
    expect(canBulkAct(portal, "restore")).toBe(false);
    expect(canBulkAct(imported, "archive")).toBe(true);
    expect(canBulkAct({ ...wp, demo: true }, "import")).toBe(false);
    expect(canBulkAct({ ...wp, recordState: "excluido" }, "restore")).toBe(true);
  });

  it("não confunde ausência de data/estado com autorização ativa", () => {
    expect(technicianState(wp)).toBe("review");
    expect(technicianState(portal)).toBe("active");
    expect(technicianState(imported)).toBe("review");
    expect(
      technicianState({ ...imported, registry: { archived: true, admin_active: false } }),
    ).toBe("inactive");
  });
});
