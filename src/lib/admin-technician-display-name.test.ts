import { describe, expect, it } from "vitest";
import { technicianDisplayName } from "./admin-technician-display-name";

describe("nome do técnico no diretório único", () => {
  it("não mostra categoria e cidade como parte do nome profissional", () => {
    expect(technicianDisplayName("TN4 Técnico de Informática Cruzeiro do Sul", "Cruzeiro do Sul")).toBe("TN4");
    expect(technicianDisplayName("Usadão 2000 Técnico de Informática Cruzeiro do Sul", "Cruzeiro do Sul"))
      .toBe("Usadão 2000");
  });

  it("não retira o nome de estabelecimentos legítimos", () => {
    expect(technicianDisplayName("Informática Curitiba", "Curitiba")).toBe("Informática Curitiba");
    expect(technicianDisplayName("Técnico de Informática Cruzeiro do Sul", "Cruzeiro do Sul"))
      .toBe("Técnico de Informática Cruzeiro do Sul");
    expect(technicianDisplayName("TN4 Técnico de Informática Cruzeiro do Sul", "Rio Branco"))
      .toBe("TN4 Técnico de Informática Cruzeiro do Sul");
    expect(technicianDisplayName("TN4 Técnico de Informática Cruzeiro do Sul"))
      .toBe("TN4 Técnico de Informática Cruzeiro do Sul");
  });
});
