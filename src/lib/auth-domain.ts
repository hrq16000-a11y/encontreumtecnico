/** Single public return origin for all production OAuth/email callbacks.
 * Supabase must allow exact /entrar and /redefinir-senha redirects.
 * Lovable editor previews and localhost retain their own origin for testing.
 */
export const EUT_CANONICAL_ORIGIN = "https://www.encontreumtecnico.com.br";

export function authReturnOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return EUT_CANONICAL_ORIGIN;
    }
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" ||
        host === "lovable.app" || host.endsWith(".lovable.app") ||
        host.endsWith(".lovableproject.com") || host.endsWith(".lovableproject-dev.com") ||
        host.endsWith(".lovable.dev") ||
        host.endsWith(".gpt-eng.com") || host.endsWith(".gptengineer.run")) return url.origin;
    return EUT_CANONICAL_ORIGIN;
  } catch {
    return EUT_CANONICAL_ORIGIN;
  }
}

export function authReturnUrl(path: "/entrar" | "/redefinir-senha", origin: string): string {
  return authReturnOrigin(origin) + path;
}
