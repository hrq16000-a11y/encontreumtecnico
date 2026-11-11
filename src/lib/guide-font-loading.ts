/** 
 * The six enriched service-category pages use a stable system font already.
 * Google Fonts stylesheet is render-blocking even when its families are unused
 * in editorial content; omit it on enriched public /servicos/:categoria pages.
 * Never change fonts on /guias index, auth, admin, Home2, or user panels.
 */
const GUIDE_DETAIL_PATTERN = /^\/(?:guias\/[a-z0-9]+(?:-[a-z0-9]+)*|servicos\/(?:computadores|cftv|redes|impressoras|software|climatizacao))\/?$/;

export function isGuideDetailHeadMatch(matches: readonly { pathname?: string }[]): boolean {
  return matches.some(({ pathname }) => typeof pathname === "string" && GUIDE_DETAIL_PATTERN.test(pathname));
}
