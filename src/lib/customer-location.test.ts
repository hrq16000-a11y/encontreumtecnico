import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseBrazilianDeviceLocation } from "./customer-location";

describe("detecção de bairro/cidade por GPS com privacidade", () => {
  it("normaliza município e UF a partir de GPS autorizado no Brasil", () => {
    expect(parseBrazilianDeviceLocation({
      countryCode: "BR", city: "Tubarão", principalSubdivisionCode: "BR-SC",
      locality: "Passo do Gado", latitude: -28.45, longitude: -49.02,
    })).toEqual({ city: "Tubarão", uf: "SC", neighborhood: "Passo do Gado" });
  });
  it("não inventa bairro quando a API repete o nome da cidade", () => {
    expect(parseBrazilianDeviceLocation({
      countryCode: "BR", city: "Curitiba", principalSubdivisionCode: "PR", locality: "curitiba",
    })).toEqual({ city: "Curitiba", uf: "PR", neighborhood: "" });
  });
  it("recusa UF inválida, país estrangeiro ou cidade desconhecida", () => {
    for (const value of [
      null, { countryCode: "AR", city: "Posadas", principalSubdivisionCode: "AR-M" },
      { countryCode: "BR", city: "A", principalSubdivisionCode: "PR" },
      { countryCode: "BR", city: "Tubarão", principalSubdivisionCode: "BR-ZZ" },
    ]) expect(parseBrazilianDeviceLocation(value)).toBeNull();
  });
  it("mantém consentimento prévio e coordenadas fora da URL interna do cliente", () => {
    const code = readFileSync("src/components/customer-location-button.tsx", "utf8");
    const locator = readFileSync("src/lib/customer-location.ts", "utf8");
    const client = readFileSync("src/routes/area-cliente.tsx", "utf8");
    const directory = readFileSync("src/routes/tecnicos.index.tsx", "utf8");
    expect(code).toContain('permission.state === "granted"');
    expect(code).toContain('onClick={() => void detect("manual")}');
    expect(locator).toContain('navigator.geolocation.getCurrentPosition');
    expect(locator).toContain('https://api.bigdatacloud.net/data/reverse-geocode-client');
    expect(locator).not.toMatch(/localStorage|sessionStorage|\.from\(|console\.log|service_role/);
    expect(client).toContain('city: area.city, region: area.neighborhood');
    expect(directory).toContain('bairro: area.neighborhood');
  });
});
