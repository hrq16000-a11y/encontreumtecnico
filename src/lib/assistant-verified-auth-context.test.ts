import { describe, expect, it } from "vitest";
import { assistantPrincipalFromVerifiedContext } from "./assistant-verified-auth-context";

const NOW = Date.parse("2026-11-13T03:00:00.000Z");
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const EXP = Math.floor((NOW + 60_000) / 1000);
const verified = () => ({ userId: USER, claims: { sub: USER, exp: EXP } });

describe("assistant verified middleware adapter — synthetic offline contract #261", () => {
  it("rejects missing verified context or unavailable server role rows", () => {
    expect(assistantPrincipalFromVerifiedContext(null, [{ role: "cliente" }], NOW)).toBeNull();
    expect(assistantPrincipalFromVerifiedContext(verified(), null, NOW)).toBeNull();
    expect(assistantPrincipalFromVerifiedContext(verified(), [], NOW)).toBeNull();
  });

  it("rejects a caller ID that differs from the verified JWT subject", () => {
    expect(assistantPrincipalFromVerifiedContext(
      { userId: OTHER, claims: { sub: USER, exp: EXP } },
      [{ role: "cliente" }], NOW,
    )).toBeNull();
  });

  it("rejects absent, malformed and expired JWT expiry claims", () => {
    for (const exp of [undefined, "9999999999", NaN, 0, Math.floor(NOW / 1000)]) {
      expect(assistantPrincipalFromVerifiedContext(
        { userId: USER, claims: { sub: USER, exp } },
        [{ role: "cliente" }], NOW,
      )).toBeNull();
    }
  });

  it("rejects non-UUID authenticated identity and subject", () => {
    expect(assistantPrincipalFromVerifiedContext(
      { userId: "client", claims: { sub: "client", exp: EXP } },
      [{ role: "cliente" }], NOW,
    )).toBeNull();
  });

  it("rejects unknown, empty or malformed role rows instead of trusting token metadata", () => {
    for (const roles of [
      [{ role: "superadmin" }],
      [{ role: "cliente" }, { role: "unknown" }],
      [{ role: null }],
    ]) {
      expect(assistantPrincipalFromVerifiedContext(verified(), roles, NOW)).toBeNull();
    }
  });

  it("maps validated middleware subject/expiry and authorized server roles only", () => {
    expect(assistantPrincipalFromVerifiedContext(
      verified(), [{ role: "cliente" }, { role: "cliente" }], NOW,
    )).toEqual({ userId: USER, roles: ["cliente"], expiresAtMs: EXP * 1000 });
  });
});
