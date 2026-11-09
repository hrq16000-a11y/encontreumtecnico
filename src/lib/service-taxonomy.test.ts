import { describe, expect, it } from "vitest";
import { serviceSlug, validMunicipality } from "./service-taxonomy";

describe("taxonomia administrável dos técnicos", () => {
  it("gera identificadores estáveis com acentuação e separadores", () => {
    expect(serviceSlug("Instalação de Câmeras e DVR")).toBe("instalacao-de-cameras-e-dvr");
    expect(serviceSlug("  Redes / Wi-Fi ")).toBe("redes-wi-fi");
  });
  it("rejeita país ou endereço sem UF como município", () => {
    expect(validMunicipality("PR","Curitiba")).toBe(true);
    expect(validMunicipality(null,"Curitiba")).toBe(false);
    expect(validMunicipality("SP","Brasil")).toBe(false);
    expect(validMunicipality("ZZ","São Paulo")).toBe(false);
  });
});
