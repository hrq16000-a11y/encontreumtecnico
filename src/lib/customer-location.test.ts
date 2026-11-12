import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseBrazilianDeviceLocation, suggestTechnicianArea } from "./customer-location";

describe("GPS informa município, mas nunca inventa bairro", () => {
  it("normaliza município e UF a partir de GPS autorizado no Brasil", () => {
    expect(parseBrazilianDeviceLocation({
      countryCode: "BR", city: "Tubarão", principalSubdivisionCode: "BR-SC",
      locality: "Passo do Gado", latitude: -28.45, longitude: -49.02,
    })).toEqual({ city: "Tubarão", uf: "SC", neighborhood: "" });
  });
  it("não inventa bairro quando a API repete o nome da cidade", () => {
    expect(parseBrazilianDeviceLocation({
      countryCode: "BR", city: "Curitiba", principalSubdivisionCode: "PR", locality: "curitiba",
    })).toEqual({ city: "Curitiba", uf: "PR", neighborhood: "" });
  });
  it("não usa localidade municipal como bairro e não toma metrópole por município", () => {
    expect(parseBrazilianDeviceLocation({
      countryCode: "BR", city: "Curitiba", principalSubdivisionCode: "BR-PR",
      locality: "São José dos Pinhais",
    })).toEqual({ city: "Curitiba", uf: "PR", neighborhood: "" });
    expect(parseBrazilianDeviceLocation({
      countryCode: "BR", city: "Região Metropolitana de Curitiba",
      locality: "São José dos Pinhais", principalSubdivisionCode: "BR-PR",
    })).toBeNull();
  });

  it("mantém Jardim Itália digitado manualmente mesmo após nova consulta GPS", () => {
    const current = { state_uf: "PR", city: "São José dos Pinhais",
      neighborhood: "Jardim Itália", region: "Centro" };
    expect(suggestTechnicianArea(current, {
      uf: "PR", city: "São José dos Pinhais", neighborhood: "São José dos Pinhais",
    }, "automatic")).toBe(current);
    expect(suggestTechnicianArea(current, {
      uf: "PR", city: "São José dos Pinhais", neighborhood: "",
    }, "manual")).toEqual(current);
  });

  it("recusa UF inválida, país estrangeiro ou cidade desconhecida", () => {
    for (const value of [
      null, { countryCode: "AR", city: "Posadas", principalSubdivisionCode: "AR-M" },
      { countryCode: "BR", city: "A", principalSubdivisionCode: "PR" },
      { countryCode: "BR", city: "Tubarão", principalSubdivisionCode: "BR-ZZ" },
    ]) expect(parseBrazilianDeviceLocation(value)).toBeNull();
  });
  it("preenche UF e cidade sem inferir bairro automaticamente", () => {
    const draft = { display_name: "Profissional", state_uf: "", city: "", neighborhood: "",
      region: "Centro e bairros vizinhos", specialties: ["redes"] };
    const located = suggestTechnicianArea(draft,
      { uf: "PR", city: "Curitiba", neighborhood: "Água Verde" }, "automatic");
    expect(located).toEqual({ ...draft, state_uf: "PR", city: "Curitiba", neighborhood: "" });
    expect(located.region).toBe("Centro e bairros vizinhos");
    expect(located.specialties).toEqual(["redes"]);
  });

  it("não sobrescreve cidade/bairro informados pelo técnico em detecção automática", () => {
    const profile = { state_uf: "SP", city: "Campinas", neighborhood: "Cambuí", bio: "Atende Campinas" };
    expect(suggestTechnicianArea(profile,
      { uf: "PR", city: "Curitiba", neighborhood: "Centro" }, "automatic")).toBe(profile);
  });

  it("permite corrigir manualmente a localidade sem publicar nem trocar especialidades", () => {
    const profile = { state_uf: "SP", city: "Campinas", neighborhood: "Centro", service_slugs: ["redes-wifi"] };
    expect(suggestTechnicianArea(profile,
      { uf: "PR", city: "Curitiba", neighborhood: "Batel" }, "manual")).toEqual({
      ...profile, state_uf: "PR", city: "Curitiba", neighborhood: "Batel",
    });
  });

  it("facilita a busca na Home e o cadastro real sem expor GPS nem endereço", () => {
    const home = readFileSync("src/routes/index.tsx", "utf8");
    const tech = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    const button = readFileSync("src/components/customer-location-button.tsx", "utf8");
    expect(home).toContain("Buscar técnicos em {city}/{locationUf}");
    expect(home).toContain('prioridade: "regiao"');
    expect(tech).toContain('purpose="technician"');
    expect(tech).toContain("previewTechnicianAreaSuggestion(current, area, source)");
    expect(tech).toContain("if (requiresConfirmation &&");
    expect(tech).toContain("updateRegistration(next);");
    expect(tech).toContain('autoIfGranted={!profileId');
    expect(button).toContain("município e UF");
    expect(button).toContain("Bairro não é identificado com segurança");
    expect(button).toContain("BigDataCloud");
    expect(button).toContain("coordenadas e IP");
    expect(tech).toContain('activationDb.rpc("eut_publish_my_technician"');
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
