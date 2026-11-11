/** The two visual reference layouts intentionally retain their own chrome. */
export function isStandaloneVisualRoute(pathname: string): boolean {
  return pathname === "/home2" || pathname === "/lp2" || pathname.startsWith("/lp2/");
}
