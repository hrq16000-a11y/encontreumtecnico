import { describe, expect, it } from "vitest";
import { discoveryChoices, resolveDiscoveryChoice } from "./nearby-discovery";
const categories = [{ slug: "redes", label: "Redes e Wi-Fi" }, { slug: "computadores", label: "Computadores" }];
const services = [{ slug: "configuracao-wifi", label: "Configuração de Wi-Fi", category_slug: "redes" },
  { slug: "formatacao", label: "Formatação", category_slug: "computadores" },
  { slug: "inativo", label: "Inativo", category_slug: "indisponivel" }];
const options = discoveryChoices(categories, services);
const resolve = (typed: string, selected = "") => resolveDiscoveryChoice(options, typed, selected, categories, services);
describe("Busca perto de mim — seleção única", () => {
  it("resolve serviço ou categoria sem acentos e preserva a categoria canônica", () => {
    expect(resolve("formatacao")).toEqual({ especialidade: "computadores", servico: "formatacao" });
    expect(resolve("Redes e Wi-Fi")).toEqual({ especialidade: "redes", servico: "" });
    expect(resolve("Configuração de Wi-Fi", "service:configuracao-wifi")).toEqual({ especialidade: "redes", servico: "configuracao-wifi" });
  });
  it("não converte texto desconhecido, ambíguo ou serviço inativo em pesquisa genérica", () => {
    expect(resolve("serviço inexistente")).toBeNull();
    expect(resolve("wi-fi")).toBeNull();
    expect(resolve("Inativo")).toBeNull();
    expect(resolve("")).toEqual({ especialidade: "Todas", servico: "" });
  });
});
