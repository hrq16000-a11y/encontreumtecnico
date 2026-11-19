/** Production OAuth/email callbacks use the public origin.
 * Supabase must explicitly allow /entrar and /redefinir-senha on any preview
 * used for authenticated QA; this client-side choice cannot add that allowlist.
 * Approved project previews and localhost retain their own origin.
 */
export const EUT_CANONICAL_ORIGIN = "https://www.encontreumtecnico.com.br";

// Restrict the exception to immutable EUT deployments in the msolus team.
// Other vercel.app hosts continue to use the canonical production callback.
const EUT_VERCEL_PREVIEW_HOST = /^encontreumtecnico-[a-z0-9]{8,16}-msolus\.vercel\.app$/;

export function authReturnOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return EUT_CANONICAL_ORIGIN;
    }
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" ||
        (url.protocol === "https:" && url.port === "" && EUT_VERCEL_PREVIEW_HOST.test(host)) ||
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
