import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { publishedTechnicianSuggestions } from "./client-technician-picker";
import type { PublicTechnician } from "./technicians.functions";

const TECH_A = "dfb569e7-c116-4519-8df2-5c7a10a20318";
const TECH_B = "aa9bff00-81ea-48f0-b1d2-fb86d6b803d3";

const publicProfile = (id: string, specialties: string[]): PublicTechnician => ({
  id, public_slug: "tecnico-exemplo", display_name: "Profissional de exemplo",
  specialties, service_slugs: [], state_uf: "PR", city: "Curitiba",
  neighborhood: "Centro", region: null, bio: null, avatar_path: null,
  service_radius_km: null, coverage_city_ids: [], online_now: false,
});

describe("Escolha de técnico dentro do formulário mobile", () => {
  it("mantém apenas UUIDs públicos e especialidades solicitadas", () => {
    const options = publishedTechnicianSuggestions([
      publicProfile(TECH_A, ["redes"]),
      publicProfile(TECH_B, ["computadores"]),
      publicProfile("cadastro-antigo", ["redes"]),
    ], "redes");
    expect(options.map((item) => item.id)).toEqual([TECH_A]);
  });

  it("nunca sugere técnico para categoria ausente e limita lista curta", () => {
    expect(publishedTechnicianSuggestions([publicProfile(TECH_A, ["redes"])], "")).toEqual([]);
    const multiple = Array.from({ length: 12 }, (_, idx) =>
      publicProfile(`aa9bff00-81ea-48f0-b1d2-${(100000000000 + idx).toString()}`, ["redes"]));
    expect(publishedTechnicianSuggestions(multiple, "redes")).toHaveLength(5);
    expect(publishedTechnicianSuggestions(multiple, "redes", 50)).toHaveLength(8);
  });

  it("usa a lista do servidor apenas de perfis aprovados e não apresenta contato", () => {
    const picker = readFileSync("src/components/client-technician-picker.tsx", "utf8");
    expect(picker).toContain("listApprovedTechnicians({");
    expect(picker).toContain("publishedTechnicianSuggestions(profiles, category)");
    expect(picker).toContain("onSelect(technician.id)");
    expect(picker).toContain("onSelect(null)");
    expect(picker).toContain("aria-pressed={selectedId === technician.id}");
    expect(picker).toContain("Nenhum perfil publicado encontrado");
    expect(picker).toContain("não envia sua descrição");
    expect(picker).not.toContain("contact_phone");
    expect(picker).not.toContain("contact_email");
    expect(picker).not.toContain("eut_share_direct_request");
  });

  it("alterar texto ou localização revoga consentimento prévio", () => {
    const route = readFileSync("src/routes/area-cliente.tsx", "utf8");
    const edit = route.slice(route.indexOf("function updateRequestField("),
      route.indexOf("function chooseTechnicianInWizard("));
    expect(edit).toContain("setShareNow(false)");
    for (const key of ["title", "description", "category", "city", "region"]) {
      expect(route).toContain(`updateRequestField("${key}", e.target.value)`);
    }
    expect(route).toContain("receiving a different target never carries a prior opt-in");
    expect(route).toContain("setShareNow(false);\n                  }} />");
  });

  it("seleciona sem navegar, preserva rascunho e exige novo consentimento", () => {
    const route = readFileSync("src/routes/area-cliente.tsx", "utf8");
    const selected = route.slice(route.indexOf("function chooseTechnicianInWizard("),
      route.indexOf("function advance()"));
    expect(selected).toContain("rememberTechnicianTarget(id)");
    expect(selected).toContain("setTechnicianTarget(id)");
    expect(selected).toContain("setShareNow(false)");
    expect(selected).not.toContain("setForm(");
    expect(selected).not.toContain("navigate(");
    expect(route).toContain("<ClientTechnicianPicker");
    expect(route).toContain("onSelect={chooseTechnicianInWizard}");
    expect(route).toContain("checked={shareNow}");
    expect(route).toContain("eut_share_direct_request");
    expect(route).toContain("if (step < 4) { advance(); return; }");
  });
});
