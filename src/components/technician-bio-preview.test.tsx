import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TechnicianBioPreview } from "./technician-bio-preview";

describe("prévia segura da apresentação no Wizard", () => {
  it("apresenta introdução e somente cartões realmente preenchidos", () => {
    const html = renderToStaticMarkup(<TechnicianBioPreview bio={[
      "Atendo redes de empresas.",
      "Minha experiência: Diagnóstico e cabeamento estruturado.",
      "Ferramentas e equipamentos: ",
    ].join("\n")} />);
    expect(html).toContain("Atendo redes de empresas.");
    expect(html).toContain("Diagnóstico e cabeamento estruturado.");
    expect(html).toContain("Experiência");
    expect(html).not.toContain("<h4 class=\"text-sm font-semibold text-foreground\">Ferramentas</h4>");
    expect(html).toContain("ainda não publicada");
  });

  it("não replica contatos ou números proibidos na prévia", () => {
    const html = renderToStaticMarkup(<TechnicianBioPreview bio="Atendo pelo 41 99999-9999" />);
    expect(html).toContain("Corrija o texto");
    expect(html).not.toContain("99999");
  });

  it("orienta sem atribuir habilidades fictícias ao técnico", () => {
    const html = renderToStaticMarkup(<TechnicianBioPreview bio="Ferramentas e equipamentos: " />);
    expect(html).toContain("complete um dos tópicos");
    expect(html).not.toContain("<h4");
  });
});
