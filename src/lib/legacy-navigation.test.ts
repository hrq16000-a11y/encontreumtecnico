import { describe, expect, it } from "vitest";
import { mapLegacyGallerySearch } from "./legacy-navigation";

describe("compatibilidade com busca do TanStack antigo", () => {
  it("preserva a cidade e transforma categorias antigas conhecidas", () => {
    expect(mapLegacyGallerySearch({q:"notebook",city:" São José dos Pinhais "})).toEqual({
      especialidade:"Computador",cidade:"São José dos Pinhais",regiao:""
    });
    expect(mapLegacyGallerySearch({q:"Redes",city:"Curitiba"}).especialidade).toBe("Comunicações");
    expect(mapLegacyGallerySearch({q:"CFTV",city:"Campinas"}).especialidade).toBe("CFTV");
  });
  it("não inventa especialidade inexistente nem executa entrada não textual", () => {
    expect(mapLegacyGallerySearch({q:"manutenção de elevador",city:"Santos"})).toEqual({
      especialidade:"Todas",cidade:"Santos",regiao:""
    });
    expect(mapLegacyGallerySearch({q:{},city:[]})).toEqual({
      especialidade:"Todas",cidade:"",regiao:""
    });
  });
  it("limita e normaliza entradas antigas", () => {
    const item=mapLegacyGallerySearch({q:"<script>",city:"<Cidade> ".repeat(30)});
    expect(item.especialidade).toBe("Todas");
    expect(item.cidade).not.toContain("<");
    expect(item.cidade.length).toBeLessThanOrEqual(80);
  });
});
