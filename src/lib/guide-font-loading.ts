/** 
 * The six editorial detail pages use a stable system font already.
 * Google Fonts stylesheet is render-blocking even when its families are unused
 * in the article; omit it only on public /guias/:slug pages.
 * Never change fonts on /guias index, auth, admin, Home2, or user panels.
 */
const GUIDE_DETAIL_PATTERN = /^\/(?:guias\/[a-z0-9]+(?:-[a-z0-9]+)*|servicos\/(?:computadores|cftv|redes|impressoras|software|climatizacao))\/?$/;

export function isGuideDetailHeadMatch(matches: readonly { pathname?: string }[]): boolean {
  return matches.some(({ pathname }) => typeof pathname === "string" && GUIDE_DETAIL_PATTERN.test(pathname));
}
