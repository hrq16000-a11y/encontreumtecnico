import { describe, expect, it } from "vitest";
import { technicianProfileWasRemoved } from "./technician-profile-removal-verification";

const removed = {
  id: "own-profile",
  status: "pendente",
  display_name: "Ficha excluída",
  city: "Não informado",
  bio: null,
  avatar_path: null,
  specialties: [],
  service_slugs: [],
};

describe("verificação da exclusão da ficha do titular", () => {
  it("confere o identificador, a ocultação e o apagamento dos dados profissionais", () => {
    expect(technicianProfileWasRemoved("own-profile", removed)).toBe(true);
    expect(technicianProfileWasRemoved("someone-else", removed)).toBe(false);
    expect(technicianProfileWasRemoved("own-profile", null)).toBe(false);
    expect(technicianProfileWasRemoved("own-profile", { ...removed, status: "aprovado" })).toBe(
      false,
    );
    expect(
      technicianProfileWasRemoved("own-profile", { ...removed, specialties: ["informatica"] }),
    ).toBe(false);
    expect(technicianProfileWasRemoved("own-profile", { ...removed, bio: "Contato" })).toBe(false);
    expect(
      technicianProfileWasRemoved("own-profile", { ...removed, avatar_path: "avatar.jpg" }),
    ).toBe(false);
    expect(technicianProfileWasRemoved("own-profile", { ...removed, city: "Curitiba" })).toBe(
      false,
    );
  });
});
