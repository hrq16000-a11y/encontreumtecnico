// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canonicalHomeCategory } from "@/components/home-category-picker";
import { homeLocationFilters, confirmedHomeCity } from "@/components/home-municipality-search";
import { saveHomeCategoryDraft } from "@/lib/home-category-draft";
import { readUiTextDraft } from "@/lib/unsent-ui-draft";

const categories = [
  { slug: "computadores", label: "Computadores e notebooks" },
  { slug: "redes", label: "Redes e conectividade" },
];
const cities = [
  { id: 4106902, name: "Curitiba", uf: "PR", latitude: 0, longitude: 0 },
  { id: 5002704, name: "Campo Grande", uf: "MS", latitude: 0, longitude: 0 },
  { id: 2701506, name: "Campo Grande", uf: "AL", latitude: 0, longitude: 0 },
];

function composedFilters(specialty: string, uf: string, city: string,
  cityId: number | null, neighborhood = "") {
  const location = homeLocationFilters(uf, city, cityId, cities, neighborhood);
  if (!location) return null;
  return { especialidade: canonicalHomeCategory(specialty, categories),
    cidade: location.cidade, uf: location.uf, bairro: location.bairro,
    regiao: "", prioridade: location.prioridade };
}

function memoryStore(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => { values.clear(); },
  };
}

describe("Home: reconciliação de especialidade ativa e município IBGE", () => {
  it("combina categoria canônica, município oficial, UF e bairro numa única navegação", () => {
    expect(composedFilters("computadores", "PR", "Curitiba", 4106902, "Centro"))
      .toEqual({ especialidade: "computadores", cidade: "Curitiba", uf: "PR",
        bairro: "Centro", regiao: "", prioridade: "regiao" });
  });

  it("texto livre de especialidade antigo nunca vira slug, mesmo com cidade válida", () => {
    expect(composedFilters("Informática", "PR", "Curitiba", 4106902))
      .toMatchObject({ especialidade: "Todas", cidade: "Curitiba", uf: "PR" });
    expect(composedFilters("redes", "PR", "", null))
      .toMatchObject({ especialidade: "redes", cidade: "", uf: "PR", prioridade: "regiao" });
    expect(composedFilters("redes", "", "", null))
      .toMatchObject({ especialidade: "redes", cidade: "", uf: "", prioridade: "" });
  });

  it("não navega com município não confirmado, ID de outra UF ou catálogo ausente", () => {
    expect(composedFilters("redes", "PR", "Curitiba", null)).toBeNull();
    expect(composedFilters("redes", "MS", "Campo Grande", 2701506)).toBeNull();
    expect(confirmedHomeCity("PR", "Curitiba", 4106902, [])).toBeNull();
    expect(canonicalHomeCategory("redes", [])).toBe("Todas");
  });

  it("trocar categoria não apaga cityid do rascunho; restaurá-lo exige revalidação", () => {
    const storage = memoryStore();
    const location = { city: "Campo Grande", uf: "MS", neighborhood: "Centro", cityId: 5002704 };
    expect(saveHomeCategoryDraft("redes", location, storage)).toBe(true);
    expect(saveHomeCategoryDraft("computadores", location, storage)).toBe(true);
    const saved = readUiTextDraft("home", storage);
    expect(saved).toEqual({
      specialty: "computadores", city: "Campo Grande", uf: "MS",
      neighborhood: "Centro", cityid: "5002704",
    });
    expect(composedFilters((saved?.["specialty"] ?? ""), (saved?.["uf"] ?? ""), (saved?.["city"] ?? ""), Number((saved?.["cityid"] ?? "")),
      (saved?.["neighborhood"] ?? ""))).toMatchObject({ cidade: "Campo Grande", uf: "MS",
        especialidade: "computadores" });
    expect(composedFilters((saved?.["specialty"] ?? ""), "PR", (saved?.["city"] ?? ""), Number((saved?.["cityid"] ?? ""))))
      .toBeNull();
  });

  it("alterar UF e limpar a cidade remove ID antigo, sem perder especialidade", () => {
    const storage = memoryStore();
    expect(saveHomeCategoryDraft("redes", {
      city: "", uf: "PR", neighborhood: "", cityId: null,
    }, storage)).toBe(true);
    expect(readUiTextDraft("home", storage)).toMatchObject({
      specialty: "redes", city: "", uf: "PR", neighborhood: "", cityid: "",
    });
  });

  it("a rota Home usa ambos os filtros e mantém a barreira de hidratação", () => {
    const source = readFileSync("src/routes/index.tsx", "utf8");
    expect(source).toContain("<HomeCategoryPicker");
    expect(source).toContain("<HomeMunicipalitySearch");
    expect(source).toContain("canonicalHomeCategory(specialty, activeCategories)");
    expect(source).toContain("homeLocationFilters(");
    expect(source).toContain("saveHomeCategoryDraft(value");
    expect(source).toContain('has_specialty: especialidade !== "Todas"');
    expect(source).toContain("!draftReady ? (");
    expect(source).toContain("cityid: cityIbgeId === null");
    expect(source).not.toContain("especialidade: specialty.trim()");
    expect(source).not.toContain('placeholder="Município (ex.:');
  });
});
