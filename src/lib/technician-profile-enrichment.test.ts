import { describe, expect, it } from "vitest";
import { addPublicProfileTopic, publicProfileHasTopic, technicianProfileEnrichment } from "./technician-profile-enrichment";

describe("enriquecimento privado e voluntário do perfil técnico", () => {
  it("adiciona somente títulos editáveis, sem inventar atributos, preços ou contatos", () => {
    const result = addPublicProfileTopic("Atendo empresas.", "tools");
    expect(result).toBe("Atendo empresas.\nFerramentas e equipamentos: ");
    expect(publicProfileHasTopic(result, "tools")).toBe(true);
    expect(addPublicProfileTopic(result, "tools")).toBe(result);
    expect(result).not.toMatch(/whatsapp|telefone|R\$|km|carro|notebook/i);
  });

  it("preserva o texto integral quando não houver espaço ou já existir o título", () => {
    const long = "x".repeat(990);
    expect(addPublicProfileTopic(long, "experience")).toBe(long);
    expect(addPublicProfileTopic("Minha experiência: instalação de redes.", "experience"))
      .toBe("Minha experiência: instalação de redes.");
  });

  it("só considera biografia de conteúdo real, sem confundir modelos vazios com informação", () => {
    const input = {
      display_name: "Técnico Teste", city: "Curitiba", state_uf: "PR", specialties: ["redes"],
      service_slugs: ["wifi"], bio: "Ferramentas e equipamentos: ",
      avatar_path: null, coverage_city_ids: [],
    };
    const result = technicianProfileEnrichment(input);
    expect(result).toMatchObject({ complete: 2, total: 5 });
    expect(result.entries[2]).toMatchObject({ complete: false, tab: "perfil" });
    expect(technicianProfileEnrichment({ ...input, bio: "Instalo redes empresariais e configuro pontos de acesso com cuidado.",
      avatar_path: "avatars/self.webp", coverage_city_ids: [4106902] })).toMatchObject({ complete: 5, total: 5 });
  });
});
