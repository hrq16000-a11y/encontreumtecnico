import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { publicTextProblem, sanitizePublicTechnician } from "./public-profile-text";

describe("proteção contra vazamento de contato em perfis públicos", () => {
  it.each([
    "SPAZZINI TECH (94) 99153-9307",
    "41 9      97     45   20    5 3",
    "41\n9\n97\n45 20\n53",
    "４１ ９ ９９１５３ ９３０７",
    "٩١ ٩٩٩٩٩-٩٩٩٩",
    "Atuo há 10 anos em redes",
    "Contato: nove quatro nove nove oito sete seis",
    "Fale pelo w h a t s a p p",
    "Visite w w w . profissional . com",
    "tecnico@exemplo.com",
    "https://meusite.com",
    "Meu contato é arroba tecnico ponto com",
  ])("rejeita a apresentação irregular: %s", (bio) => {
    expect(publicTextProblem(bio, "bio")).not.toBeNull();
  });
  it.each([
    "Sou profissional de manutenção de computadores, redes e CFTV.",
    "Atendo residências e empresas na região de Curitiba.",
    "Especialista em instalação e manutenção de impressoras.",
  ])("aceita apresentações simples: %s", (bio) => {
    expect(publicTextProblem(bio, "bio")).toBeNull();
  });
  it("não transforma modelo de produto em falso telefone no nome, mas bloqueia contato fragmentado", () => {
    expect(publicTextProblem("Oficina 0WEB", "identity")).toBeNull();
    expect(publicTextProblem("Técnico 41 9 97 45 20 53", "identity")).not.toBeNull();
    expect(publicTextProblem("serviços@exemplo.com", "identity")).not.toBeNull();
  });
  it("mascara perfis antigos na resposta pública sem mudar o registro original", () => {
    const profile = { display_name: "Profissional", bio: "Ligue 41 99999-9999", region: "São José dos Pinhais", neighborhood: null };
    expect(sanitizePublicTechnician(profile)).toEqual({ ...profile, bio: null });
    expect(profile.bio).toContain("Ligue");
  });
  it("é aplicado antes da saída do servidor e validado em ambos os editores", () => {
    const srv = readFileSync("src/lib/technicians.functions.ts", "utf8");
    const form = readFileSync("src/routes/area-tecnico.tsx", "utf8");
    const admin = readFileSync("src/components/admin-technician-manager.tsx", "utf8");
    const safeView = readFileSync("src/lib/technician-public-view.ts", "utf8");
    expect(srv).toContain("toSafePublicTechnician");
    expect(safeView).toContain("sanitizePublicTechnician");
    expect(form).toContain('publicTextProblem(form.bio, "bio")');
    expect(admin).toContain('publicTextProblem(draft.bio, "bio")');
  });
});
