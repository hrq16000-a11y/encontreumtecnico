import { describe, expect, it } from "vitest";
import { galleryDraftForUrl, restoreGalleryDraft } from "./gallery-search-draft";
describe("LP2 gallery URL history versus unfinished text", () => {
  it("recovers all unfinished filters only when returning to the same URL", () => {
    const url = { q: "notebook", city: "Curitiba" };
    const saved = galleryDraftForUrl(url, { query: "notebook e rede", city: "São José dos Pinhais", uf: "PR", sort: "complete" });
    expect(restoreGalleryDraft(url, saved)).toEqual({
      query: "notebook e rede", city: "São José dos Pinhais", uf: "PR", sort: "complete",
    });
  });
  it("honors explicit navigation and browser history over unrelated stale inputs", () => {
    const prev = { q: "notebook", city: "Curitiba" };
    const saved = galleryDraftForUrl(prev, { query: "redes", city: "Pinhais", uf: "PR", sort: "complete" });
    expect(restoreGalleryDraft({ q: "impressora", city: "Londrina" }, saved))
      .toEqual({ query: "impressora", city: "Londrina", uf: "", sort: "name" });
  });
  it("never invents a category or enables an invalid sort option", () => {
    expect(restoreGalleryDraft({ q: "", city: "" }, { urlq: "", urlcity: "", sort: "invalid" }))
      .toEqual({ query: "", city: "", uf: "", sort: "name" });
  });
});
