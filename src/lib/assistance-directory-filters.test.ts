import { describe, expect, it } from "vitest";
import { assistanceDirectoryFilters } from "./assistance-directory-filters";

const categories = [
  { slug: "computadores", label: "Computadores e notebooks" },
  { slug: "redes", label: "Redes e conectividade" },
  { slug: "cftv", label: "Câmeras e segurança eletrônica" },
  { slug: "software", label: "Sistemas e software" },
];
const services = [
  { slug: "formatacao-de-notebooks", label: "Formatação de notebooks", category_slug: "computadores" },
  { slug: "configuracao-de-wifi", label: "Configuração de Wi-Fi", category_slug: "redes" },
  { slug: "servico-inativo", label: "Serviço inativo", category_slug: "categoria-inativa" },
];

describe("retorno do pedido para os filtros oficiais da busca", () => {
  it("conserva categoria do funil somente quando estiver ativa", () => {
    expect(assistanceDirectoryFilters("Redes e Wi-Fi", categories, services))
      .toEqual({ especialidade: "redes", servico: "" });
    expect(assistanceDirectoryFilters("CFTV e segurança", categories, services))
      .toEqual({ especialidade: "cftv", servico: "" });
    expect(assistanceDirectoryFilters("Automação", categories, services))
      .toEqual({ especialidade: "Todas", servico: "" });
    expect(assistanceDirectoryFilters("redes", categories, services))
      .toEqual({ especialidade: "redes", servico: "" });
  });

  it("preserva o slug de serviço ativo, por label ou slug exatos", () => {
    const filters = { especialidade: "computadores", servico: "formatacao-de-notebooks" };
    expect(assistanceDirectoryFilters("Formatação de notebooks", categories, services)).toEqual(filters);
    expect(assistanceDirectoryFilters("formatacao-de-notebooks", categories, services)).toEqual(filters);
    expect(assistanceDirectoryFilters("configuracao-de-wifi", categories, services))
      .toEqual({ especialidade: "redes", servico: "configuracao-de-wifi" });
  });

  it("não fabrica slugs a partir de texto livre, serviços órfãos ou falha de catálogo", () => {
    for (const selected of ["Outro serviço", "Instalação inexistente", "servico-inativo"]) {
      expect(assistanceDirectoryFilters(selected, categories, services))
        .toEqual({ especialidade: "Todas", servico: "" });
    }
    expect(assistanceDirectoryFilters("Formatação de notebooks", [], services))
      .toEqual({ especialidade: "Todas", servico: "" });
    expect(assistanceDirectoryFilters("Redes e Wi-Fi", categories, []))
      .toEqual({ especialidade: "redes", servico: "" });
  });

  it("não escolhe aleatoriamente serviço quando rótulos ativos são ambíguos", () => {
    expect(assistanceDirectoryFilters("Configuração de Wi-Fi", categories, [
      ...services, { slug: "segundo-servico", label: "Configuração de Wi-Fi", category_slug: "redes" },
    ])).toEqual({ especialidade: "Todas", servico: "" });
  });
});
