import { beforeEach, describe, expect, it } from "vitest";
import { clearUiTextDraft, readUiTextDraft, saveUiTextDraft } from "./unsent-ui-draft";
beforeEach(() => sessionStorage.clear());
describe("navigation draft for non-sensitive search fields", () => {
  it("restores city and specialty when revisiting Home on the same tab", () => {
    saveUiTextDraft("home", { specialty:"Redes", city:"Curitiba", uf:"PR", neighborhood:"Centro" }, sessionStorage, 100000);
    expect(readUiTextDraft("home", sessionStorage, 100000)).toEqual({specialty:"Redes",city:"Curitiba",uf:"PR",neighborhood:"Centro"});
    expect(readUiTextDraft("problem", sessionStorage, 100000)).toBeNull();
  });
  it("never stores huge data and expires after 45 minutes", () => {
    expect(saveUiTextDraft("problem", { description: "a".repeat(4000) }, sessionStorage)).toBe(false);
    saveUiTextDraft("problem", { description: "Meu notebook não liga" }, sessionStorage, 100000);
    expect(readUiTextDraft("problem", sessionStorage, 100000 + 46 * 60 * 1000)).toBeNull();
  });
  it("clears only the selected route's draft", () => {
    saveUiTextDraft("home", { city: "Pinhais" }, sessionStorage);
    saveUiTextDraft("lp2-home", { city: "Curitiba" }, sessionStorage);
    clearUiTextDraft("home", sessionStorage);
    expect(readUiTextDraft("home", sessionStorage)).toBeNull();
    expect(readUiTextDraft("lp2-home", sessionStorage)?.city).toBe("Curitiba");
  });
});
