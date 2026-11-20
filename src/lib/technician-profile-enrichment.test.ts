import { describe, expect, it } from "vitest";
import { addPublicProfileTopic, parseProfessionalBio, publicProfileHasTopic, technicianProfileEnrichment } from "./technician-profile-enrichment";

describe("enriquecimento privado e voluntário do perfil técnico", () => {
  it("adiciona somente títulos editáveis, sem inventar atributos, preços ou contatos", () => {
    const result = addPublicProfileTopic("Atendo empresas.", "tools");
    expect(result).toBe("Atendo empresas.\nFerramentas e equipamentos: ");
    expect(publicProfileHasTopic(result, "tools")).toBe(true);
    expect(addPublicProfileTopic(result, "tools")).toBe(result);
    expect(result).not.toMatch(/whatsapp|telefone|R\$|km|carro|notebook/i);
  });

  it("permite informar formação e cursos sem presumir diploma ou certificação", () => {
    const headingOnly = addPublicProfileTopic("", "training");
    expect(headingOnly).toBe("Minha formação e cursos: ");
    expect(publicProfileHasTopic(headingOnly, "training")).toBe(true);
    expect(parseProfessionalBio(headingOnly).sections).toEqual([]);
    const declared = "Atuo com redes.\nMinha formação e cursos: Curso livre de redes e cabeamento.";
    expect(addPublicProfileTopic(declared, "training")).toBe(declared);
    expect(parseProfessionalBio(declared)).toEqual({
      introduction: "Atuo com redes.",
      sections: [{ id: "training", label: "Formação e cursos", text: "Curso livre de redes e cabeamento." }],
    });
    const input = { display_name: "Técnico Teste", city: "Curitiba", state_uf: "PR",
      specialties: ["redes"], service_slugs: ["wifi"], avatar_path: null, coverage_city_ids: [] };
    expect(technicianProfileEnrichment({ ...input, bio: headingOnly }).entries[2]?.complete).toBe(false);
    expect(technicianProfileEnrichment({ ...input, bio: declared }).entries[2]?.complete).toBe(true);
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
  it("separa somente informações realmente declaradas, sem criar cartões vazios", () => {
    const bio = [
      "Atendo redes de empresas.",
      "Minha experiência: Cabeamento estruturado e roteadores.",
      "Ferramentas e equipamentos: Testador de cabos e notebook.",
      "Como me desloco para atender: Veículo próprio sob consulta.",
      "Horários em que costumo atender: Dias úteis e eventualmente à noite.",
    ].join("\n");
    const result = parseProfessionalBio(bio);
    expect(result.introduction).toBe("Atendo redes de empresas.");
    expect(result.sections.map(({ id }) => id)).toEqual(["experience", "tools", "mobility", "schedule"]);
    expect(result.sections[1]?.text).toBe("Testador de cabos e notebook.");
    expect(result.sections[3]?.text).toContain("eventualmente à noite");
  });

  it("omite títulos sem conteúdo e mantém a apresentação comum sem transformação", () => {
    expect(parseProfessionalBio(null)).toEqual({ introduction: "", sections: [] });
    expect(parseProfessionalBio("Trabalho em manutenção de redes.")).toEqual({
      introduction: "Trabalho em manutenção de redes.", sections: [],
    });
    const bio = "Ferramentas e equipamentos: \nMinha experiência: Serviços realizados.\nMinha experiência: Diagnóstico de redes.";
    expect(parseProfessionalBio(bio).sections).toEqual([
      { id: "experience", label: "Experiência", text: "Serviços realizados.\nDiagnóstico de redes." },
    ]);
  });

});
