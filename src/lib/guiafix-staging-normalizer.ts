/** Admin-only index of previously captured public technician names.
 * This does not create a technician account, contact entitlement or service area.
 */
export type GuiafixAdminRow = {
  key: string;
  name: string;
  city: string;
  uf: string;
  cityIbgeId: number;
  category: "Técnico de Informática";
};

type Capture = {
  source_page?: unknown;
  city?: unknown;
  uf?: unknown;
  city_ibge?: unknown;
  category?: unknown;
  single_capture_confirmed?: unknown;
  listings?: unknown;
};

export function normalizeGuiafixSearch(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

/** Stable admin import key. The original capture key stays private and unchanged. */
export function guiafixAdminSourceId(key: string): string {
  const normalized = normalizeGuiafixSearch(key);
  const slug = normalized.replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "").slice(0, 70).replace(/-$/g, "") || "tecnico";
  let first = 2166136261;
  let second = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = Math.imul(second ^ (code + index), 16777619) >>> 0;
  }
  const suffix = [first, second].map((value) => value.toString(16).padStart(8, "0")).join("-");
  return `guiafix:${slug}-${suffix}`;
}

export function readGuiafixStaging(captures: readonly unknown[]): GuiafixAdminRow[] {
  const seen = new Set<string>();
  const result: GuiafixAdminRow[] = [];
  for (const raw of captures) {
    if (!raw || typeof raw !== "object") continue;
    const capture = raw as Capture;
    if (typeof capture.source_page !== "string" ||
      typeof capture.city !== "string" || !/^[\p{L}\s'-]{3,100}$/u.test(capture.city) ||
      typeof capture.uf !== "string" || !/^[A-Z]{2}$/.test(capture.uf) ||
      typeof capture.city_ibge !== "number" || !Number.isInteger(capture.city_ibge) ||
      capture.city_ibge < 1000000 || capture.city_ibge > 9999999 ||
      capture.category !== "tecnico-de-informatica" ||
      capture.single_capture_confirmed !== true ||
      !Array.isArray(capture.listings) || capture.listings.length > 2500) continue;
    let source: URL;
    try { source = new URL(capture.source_page); } catch { continue; }
    if (source.protocol !== "https:" ||
      !["guiafix.com.br", "www.guiafix.com.br"].includes(source.hostname) ||
      source.username || source.password || source.search || source.hash ||
      !source.pathname.endsWith("/tecnico-de-informatica")) continue;

    for (const candidate of capture.listings) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate) ||
        Object.keys(candidate).length !== 1 || !("public_name" in candidate) ||
        typeof candidate.public_name !== "string") continue;
      const name = candidate.public_name.trim().replace(/\s+/g, " ");
      if (name.length < 3 || name.length > 100 ||
        /(?:\.\.\.|…|@|https?:|www\.|wa\.me|\+?\d[\d\s().-]{7,}\d)/i.test(name)) continue;
      const key = `${capture.uf}:${normalizeGuiafixSearch(capture.city)}:${normalizeGuiafixSearch(name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ key, name, city: capture.city, uf: capture.uf,
        cityIbgeId: capture.city_ibge, category: "Técnico de Informática" });
    }
  }
  return result.sort((a,b)=> a.name.localeCompare(b.name,"pt-BR") || a.city.localeCompare(b.city,"pt-BR"));
}
