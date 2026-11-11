/** Importação offline de uma única página/categoria/município; nunca navega ou escreve no banco.
 * Somente dados mínimos de listagens públicas. Não cria conta, login, contato, ou reivindicação.
 */
export function stagePublicDirectoryBatch(input) {
  if (!input || typeof input !== "object") throw Error("Lote inválido");
  const url = new URL(input.source_page);
  const host = url.hostname.toLowerCase();
  const origin = host === "guiafix.com.br" || host === "www.guiafix.com.br"
    ? "guiafix" : host === "encontrey.com.br" || host === "www.encontrey.com.br"
    ? "encontrey" : null;
  if (url.protocol !== "https:" || !origin || url.username || url.password ||
      url.search || url.hash) throw Error("Origem não permitida");
  if (input.category !== "tecnico-de-informatica" || input.uf !== "PR" ||
      input.city !== "Almirante Tamandaré" || input.city_ibge !== 4100400)
    throw Error("Apenas categoria e município do lote autorizado");
  if (origin === "guiafix" && url.pathname !== "/almirante-tamandare-pr/tecnico-de-informatica")
    throw Error("Página de categoria divergente");
  if (!Array.isArray(input.listings) || input.listings.length > 2500)
    throw Error("Lote inválido ou grande demais");
  const normal = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
  const seen = new Set();
  const listings = [];
  for (const raw of input.listings) {
    if (!raw || typeof raw.public_name !== "string") continue;
    const name = raw.public_name.trim().replace(/\s+/g, " ");
    // Não importar nomes truncados, contatos, links ou dados potencialmente identificadores de contato.
    if (name.length < 3 || name.length > 100 || /(?:\.\.\.|…|@|https?:|www\.|wa\.me|\+?\d[\d\s().-]{7,}\d)/i.test(name)) continue;
    const key = normal(name);
    if (seen.has(key)) continue;
    seen.add(key);
    listings.push({
      public_name: name,
      city: input.city, uf: input.uf, city_ibge: input.city_ibge,
      category: input.category, source: origin, source_page: url.toString(),
      status: "quarentena_nao_reivindicado",
      claimed: false, authorized_contact: false, published: false,
    });
  }
  return {
    source: origin, source_page: url.toString(), city: input.city,
    uf: input.uf, city_ibge: input.city_ibge, category: input.category,
    scraped_once: Boolean(input.single_capture_confirmed),
    imported_accounts: 0, published: 0, listings,
  };
}
