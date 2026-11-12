/**
 * Scope warmer surfaces to public discovery pages. Avoid private panels,
 * Auth, lead/payment funnels and the separately themed Home2/LP2.
 * Match complete path segments, not approximate prefixes.
 */
const PUBLIC_SECTIONS = [
  "/tecnicos", "/tecnico", "/servicos", "/categorias",
  "/cidades", "/galeria", "/guias", "/cobertura",
  "/como-funciona", "/faq", "/ecossistema",
] as const;

export function isPublicVisualRoute(pathname: string): boolean {
  const cleanPath = (pathname.split(/[?#]/, 1)[0] ?? "").replace(/\/+$/, "") || "/";
  return cleanPath === "/" ||
    PUBLIC_SECTIONS.some(section =>
      cleanPath === section || cleanPath.startsWith(`${section}/`));
}
