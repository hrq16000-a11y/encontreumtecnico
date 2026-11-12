import { safeLegacyClaimReturnPath } from "@/lib/legacy-claim-validation";
import { regionalClientReturnPath } from "@/lib/regional-client-intent";

type AccountRole = "admin" | "tecnico" | "cliente";

/** Navigation only. Admin access is ALWAYS checked again by the server/RLS. */
export function accountLanding(roles: readonly AccountRole[], lp2 = false): string {
  if (roles.includes("admin")) return lp2 ? "/lp2/admin" : "/admin";
  if (roles.includes("tecnico")) return lp2 ? "/lp2/meu-perfil" : "/area-tecnico";
  if (roles.includes("cliente")) return lp2 ? "/lp2/cliente" : "/area-cliente";
  return lp2 ? "/lp2/entrar" : "/entrar";
}

function pathnameOnly(path: string): string {
  return (path.split(/[?#]/, 1)[0] || "/").replace(/\/+$/, "") || "/";
}

export function isTechnicianDetailPath(path: string): boolean {
  const normalized = pathnameOnly(path);
  return normalized.startsWith("/tecnicos/") && normalized.length > "/tecnicos/".length;
}

/** Do not cover onboarding forms, internal panels or sticky profile CTAs. */
export function showMobileQuickTabs(path: string): boolean {
  const normalized = pathnameOnly(path);
  if (isTechnicianDetailPath(normalized)) return false;
  if (new Set([
    "/entrar", "/cadastro", "/redefinir-senha", "/reivindicar-cadastro",
    "/admin", "/area-cliente", "/area-tecnico",
  ]).has(normalized)) return false;
  if (normalized.startsWith("/acesso-contato/") ||
      normalized.startsWith("/convite/") ||
      normalized.startsWith("/lp2/")) return false;
  return true;
}

/** Protect against stale role targets, arbitrary sessionStorage redirects and
 * dead login loops. Preserve only explicit same-site destinations.
 */
export function safeLoginDestination(raw: string | null, roles: readonly AccountRole[], lp2 = false): string {
  const fallback = accountLanding(roles, lp2);
  if (!raw || raw.length > 400 || !raw.startsWith("/") ||
      raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f\u007f]/u.test(raw)) return fallback;

  const claim = safeLegacyClaimReturnPath(raw);
  if (claim) return claim;
  let url: URL;
  try { url = new URL(raw, "https://example.invalid"); } catch { return fallback; }
  if (url.origin !== "https://example.invalid" || url.hash) return fallback;
  const path = pathnameOnly(url.pathname);
  if (path === "/entrar" || path === "/cadastro" || path === "/lp2/entrar") return fallback;
  if ((path === "/admin" || path === "/lp2/admin") && roles.includes("admin")) return path;
  if ((path === "/area-tecnico" || path === "/lp2/meu-perfil") && roles.includes("tecnico")) return path;
  if ((path === "/area-cliente" || path === "/lp2/cliente") && roles.includes("cliente")) {
    if (path === "/area-cliente" && url.searchParams.get("modo") === "regional") {
      return regionalClientReturnPath(url.searchParams.get("categoria"));
    }
    const target = url.searchParams.get("tecnico");
    return path === "/area-cliente" && target && /^[a-f0-9-]{36}$/i.test(target) ?
      path + "?tecnico=" + target : path;
  }
  if (new Set(["/", "/tecnicos", "/servicos", "/como-funciona", "/faq", "/contato"]).has(path)) return path;
  if (isTechnicianDetailPath(path) && /^\/tecnicos\/[a-z0-9-]{2,96}$/i.test(path)) return path;
  return fallback;
}
