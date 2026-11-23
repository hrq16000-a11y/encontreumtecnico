import { describe, expect, it } from "vitest";
import { DEFAULT_DIRECTORY_DISPLAY, parseDirectoryDisplaySettings } from "./directory-display-settings";
import { rankTechniciansByDeclaredArea } from "./technician-local-ranking";

const base = { state_uf: "PR", city: "Curitiba", neighborhood: null, online_now: false,
  referral_highlight: false, pioneer_bronze: false };
const area = { uf: "PR", cidade: "Curitiba", bairro: "" };

describe("controles públicos de relevância regional", () => {
  it("não aceita preferências parciais ou campos inesperados de RPC", () => {
    expect(parseDirectoryDisplaySettings({ auto_region: false })).toEqual(DEFAULT_DIRECTORY_DISPLAY);
    expect(parseDirectoryDisplaySettings({ ...DEFAULT_DIRECTORY_DISPLAY, email: "privado" }))
      .toEqual(DEFAULT_DIRECTORY_DISPLAY);
  });

  it("prioriza localidade antes de qualquer destaque e não altera a fonte", () => {
    const profiles = [
      { ...base, id: "far", city: "Londrina", online_now: true, referral_highlight: true },
      { ...base, id: "near" },
    ];
    expect(rankTechniciansByDeclaredArea(profiles, area, DEFAULT_DIRECTORY_DISPLAY)
      .map(p => p.id)).toEqual(["near", "far"]);
    expect(profiles[0]?.id).toBe("far");
  });

  it("desliga desempates sem rebaixar a preferência regional", () => {
    const profiles = [
      { ...base, id: "ordinary" },
      { ...base, id: "active", online_now: true, referral_highlight: true, pioneer_bronze: true },
    ];
    expect(rankTechniciansByDeclaredArea(profiles, area).map(p => p.id)).toEqual(["active", "ordinary"]);
    const disabled = { ...DEFAULT_DIRECTORY_DISPLAY, online_priority: false,
      referral_priority: false, pioneer_priority: false };
    expect(rankTechniciansByDeclaredArea(profiles, area, disabled).map(p => p.id))
      .toEqual(["ordinary", "active"]);
  });
});
