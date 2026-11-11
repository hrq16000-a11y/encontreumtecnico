import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatPublicLocation, isBroadRegionalLabel, sameMunicipalityAsNeighborhood, safeNeighborhood } from "./location-labels";

describe("Separação rigorosa entre município e bairro", () => {
  it("elimina bairro que duplica município sem apagar bairro legítimo", () => {
    expect(sameMunicipalityAsNeighborhood("São José dos Pinhais", "São José dos Pinhais")).toBe(true);
    expect(sameMunicipalityAsNeighborhood("Sao Jose dos Pinhais/PR", "São José dos Pinhais")).toBe(true);
    expect(safeNeighborhood("São José dos Pinhais", "São José dos Pinhais")).toBe("");
    expect(safeNeighborhood("Jardim Itália", "São José dos Pinhais")).toBe("Jardim Itália");
    expect(safeNeighborhood("Centro", "São José dos Pinhais")).toBe("Centro");
  });
  it("não apresenta regiões metropolitanas como cidades-base precisas", () => {
    expect(isBroadRegionalLabel("Região Metropolitana de Curitiba")).toBe(true);
    expect(isBroadRegionalLabel("Grande Curitiba")).toBe(true);
    expect(isBroadRegionalLabel("São José dos Pinhais")).toBe(false);
  });
  it("mostra uma vez município/bairro/região em cartões e perfis", () => {
    expect(formatPublicLocation({
      city: "São José dos Pinhais", state_uf: "PR",
      neighborhood: "São José dos Pinhais", region: "São José dos Pinhais",
    })).toBe("São José dos Pinhais/PR");
    expect(formatPublicLocation({
      city: "São José dos Pinhais", state_uf: "PR",
      neighborhood: "Jardim Itália", region: "Jardim Itália",
    })).toBe("São José dos Pinhais/PR · Jardim Itália");
    expect(formatPublicLocation({
      city: "Curitiba", state_uf: "PR", neighborhood: "Água Verde",
      region: "Zona Sul",
    })).toBe("Curitiba/PR · Água Verde · Zona Sul");
  });
  it("preserva registro e bloqueio de publicação enquanto remove repetição visual", () => {
    const registration = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    const card = readFileSync("src/components/technician-search-card.tsx", "utf8");
    const profile = readFileSync("src/components/public-technician-profile.tsx", "utf8");
    const gps = readFileSync("src/lib/customer-location.ts", "utf8");
    expect(registration).toContain("safeNeighborhood(form.neighborhood, form.city)");
    expect(registration).toContain("_neighborhood: safeNeighborhood(form.neighborhood, form.city) || null");
    expect(registration).toContain("Ex.: Jardim Itália");
    expect(registration).toContain("saveTechnicianDraftImmediately");
    expect(registration).toContain("eut_publish_my_technician");
    expect(card).toContain("formatPublicLocation(t)");
    expect(profile).toContain("formatPublicLocation(t)");
    expect(gps).toContain('return { city, uf, neighborhood: "" }');
    expect(gps).not.toContain('const neighborhood = locality');
    for(const text of [registration,card,profile]) {
      expect(text).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});
