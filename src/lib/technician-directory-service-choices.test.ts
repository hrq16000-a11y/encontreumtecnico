import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { directoryServiceChoices } from "./technician-directory-service-choices";

const categories = [
  { slug: "computadores", label: "Computadores" },
  { slug: "redes", label: "Redes e conexões" },
];
const services = [
  { slug: "formatacao", label: "Formatação", category_slug: "computadores" },
  { slug: "wifi", label: "Instalação de Wi-Fi", category_slug: "redes" },
  { slug: "cabos", label: "Cabeamento óptico", category_slug: "redes" },
  { slug: "legado", label: "Serviço antigo", category_slug: "inativa" },
];

describe("Busca rápida de serviços no diretório", () => {
  it("encontra nomes e slugs ignorando acentos e diferenças de maiúsculas", () => {
    expect(directoryServiceChoices(services, categories, "Todas", "INSTALACAO", "").map(x => x.slug))
      .toEqual(["wifi"]);
    expect(directoryServiceChoices(services, categories, "Todas", "optico", "").map(x => x.slug))
      .toEqual(["cabos"]);
    expect(directoryServiceChoices(services, categories, "Todas", "formatacao", "").map(x => x.slug))
      .toEqual(["formatacao"]);
  });

  it("aceita nome da especialidade oficial, sem atribuir categoria a legado", () => {
    expect(directoryServiceChoices(services, categories, "Todas", "conexoes", "").map(x => x.slug))
      .toEqual(["wifi", "cabos"]);
    expect(directoryServiceChoices(services, categories, "Todas", "inativa", "").map(x => x.slug))
      .toEqual([]);
  });

  it("preserva o serviço selecionado quando o texto filtra outras opções", () => {
    expect(directoryServiceChoices(services, categories, "Todas", "wifi", "formatacao").map(x => x.slug))
      .toEqual(["formatacao", "wifi"]);
    expect(directoryServiceChoices(services, categories, "Todas", "  ", "formatacao"))
      .toEqual(services);
    expect(services.map(x => x.slug)).toEqual(["formatacao", "wifi", "cabos", "legado"]);
  });

  it("não permite que o texto ou a seleção ignorem a especialidade", () => {
    expect(directoryServiceChoices(services, categories, "redes", "", "formatacao").map(x => x.slug))
      .toEqual(["wifi", "cabos"]);
    expect(directoryServiceChoices(services, categories, "computadores", "redes", "wifi"))
      .toEqual([]);
  });

  it("liga a busca local ao select sem realizar consultas ou rastrear o texto", () => {
    const route = readFileSync("src/routes/tecnicos.index.tsx", "utf8");
    expect(route).toContain('id="filtro-servico-busca"');
    expect(route).toContain('value={serviceQuery}');
    expect(route).toContain('onChange={(event) => setServiceQuery(event.target.value)}');
    expect(route).toContain('directoryServiceChoices(services, categories, specialty, serviceQuery, search.servico)');
    expect(route).toContain("directoryServiceOptions.map((service)");
    expect(route).toContain('onChange={(e) => { update({ servico: e.target.value }); trackFilter("servico", e.target.value); }}');
    expect(route).not.toContain('trackFilter("servico", serviceQuery)');
  });
});
