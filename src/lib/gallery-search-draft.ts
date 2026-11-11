/** Gallery drafts must belong to the URL the user was editing.
 * An explicit link or Back/Forward change has precedence over stale input.
 * Contains only public search terms, not customer or technician contacts.
 */
export type GallerySearchUrl = { q: string; city: string };
export type GalleryFields = { query: string; city: string; uf: string; sort: string };
export function restoreGalleryDraft(url: GallerySearchUrl, saved: Record<string, string> | null): GalleryFields {
  if (saved?.["urlq"] === url.q && saved?.["urlcity"] === url.city) {
    return {
      query: saved["query"] ?? url.q,
      city: saved["city"] ?? url.city,
      uf: saved["uf"] ?? "",
      sort: saved["sort"] === "complete" ? "complete" : "name",
    };
  }
  return { query: url.q, city: url.city, uf: "", sort: "name" };
}
export function galleryDraftForUrl(url: GallerySearchUrl, fields: GalleryFields): Record<string, string> {
  return { ...fields, urlq: url.q, urlcity: url.city };
}
