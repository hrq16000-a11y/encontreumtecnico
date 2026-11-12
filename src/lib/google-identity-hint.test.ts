import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { googleIdentityHint, safeGoogleAvatarUrl } from "./google-identity-hint";
import { normalizeSignupIntent } from "./signup-intent";
import { readFileSync } from "node:fs";
const user = (overrides: Record<string, unknown> = {}) => ({
  id: "account-1", email: "account@example.org", email_confirmed_at: "2026-11-11T12:00:00Z",
  app_metadata: { provider: "google", providers: ["google"] },
  identities: [{ provider: "google" }],
  user_metadata: {},
  ...overrides,
}) as User;

describe("Google user info is only a convenient account display hint", () => {
  it("reads first name, surname and verified principal email without trusting metadata email", () => {
    const data = googleIdentityHint(user({ user_metadata: {
      given_name: "Ana", family_name: "Silva", email: "attacker@invalid.test",
      picture: "https://lh3.googleusercontent.com/photo.jpg",
    } }));
    expect(data).toMatchObject({ fullName: "Ana Silva", firstName: "Ana", lastName: "Silva",
      email: "account@example.org", googleConnected: true, emailConfirmed: true,
      avatarUrl: "https://lh3.googleusercontent.com/photo.jpg" });
  });
  it("prefers full name from provider and keeps existing email role untouched", () => {
    const data = googleIdentityHint(user({ user_metadata: { full_name: "João de Souza",
      avatar_url: "https://lh3.googleusercontent.com/a/ABCD" } }));
    expect(data.fullName).toBe("João de Souza");
    expect(data.email).toBe("account@example.org");
    expect(data.avatarUrl).toMatch(/^https:/);
    expect(Object.keys(data)).not.toContain("role");
  });
  it.each(["javascript:alert(1)", "http://lh3.googleusercontent.com/a",
    "https://googleusercontent.com.evil.example/a", "https://example.com/pic",
    "https://evil.example@googleusercontent.com@evil.example/a", ""])( "blocks unsafe photo URL %s", url => {
    expect(safeGoogleAvatarUrl(url)).toBeNull();
  });
  it("does not show a Google photo for unrelated email-password identities", () => {
    const data = googleIdentityHint(user({ identities: [], app_metadata: { provider: "email" },
      user_metadata: { full_name: "Nome editável", picture: "https://lh3.googleusercontent.com/photo" } }));
    expect(data.googleConnected).toBe(false);
    expect(data.avatarUrl).toBeNull();
  });
});

describe("signup role preference never grants roles", () => {
  it("allows only known UI intent values", () => {
    expect(normalizeSignupIntent("tecnico")).toBe("tecnico");
    expect(normalizeSignupIntent("cliente")).toBe("cliente");
    expect(normalizeSignupIntent("admin")).toBeNull();
    expect(normalizeSignupIntent("__proto__")).toBeNull();
  });
  it("preserves role assignment as authenticated server RPC", () => {
    const login = readFileSync("src/routes/entrar.tsx", "utf8");
    const signup = readFileSync("src/routes/cadastro.tsx", "utf8");
    expect(login).toContain('supabase.rpc("choose_account_type", { _role: role })');
    expect(signup).toContain('rememberSignupIntent(card.intent)');
    expect(signup).not.toMatch(/setRole\(|user_roles.*insert/);
    expect(signup).not.toContain('throw redirect');
  });
});
