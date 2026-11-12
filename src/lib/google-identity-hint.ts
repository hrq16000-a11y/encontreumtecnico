import type { User } from "@supabase/supabase-js";

/** Display hints from consented OAuth profile. NEVER trust user_metadata for auth. */
export type GoogleIdentityHint = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  googleConnected: boolean;
  emailConfirmed: boolean;
};

function clean(value: unknown, max = 80): string {
  return typeof value === "string"
    ? value.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, max) : "";
}

/** Only known Google profile image hosts are loaded in private account views. */
export function safeGoogleAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host !== "googleusercontent.com" && !host.endsWith(".googleusercontent.com")) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function googleIdentityHint(user: User): GoogleIdentityHint {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const rawFirst = clean(meta["given_name"] ?? meta["first_name"]);
  const rawLast = clean(meta["family_name"] ?? meta["last_name"]);
  const name = clean(meta["full_name"] ?? meta["name"]) || [rawFirst, rawLast].filter(Boolean).join(" ");
  const parts = name.split(/\s+/u).filter(Boolean);
  const firstName = rawFirst || parts[0] || "";
  const lastName = rawLast || (parts.length > 1 ? parts.slice(1).join(" ") : "");
  // Provider linked identities and app_metadata are descriptive only.
  const googleConnected = (user.identities ?? []).some((identity) => identity.provider === "google") ||
    user.app_metadata?.provider === "google" ||
    (Array.isArray(user.app_metadata?.providers) && user.app_metadata.providers.includes("google"));
  return {
    fullName: name,
    firstName,
    lastName,
    // User.email is the Supabase Auth principal; NEVER trust metadata email.
    email: clean(user.email, 254),
    avatarUrl: googleConnected ? safeGoogleAvatarUrl(meta["avatar_url"] ?? meta["picture"]) : null,
    googleConnected,
    emailConfirmed: Boolean(user.email_confirmed_at),
  };
}
