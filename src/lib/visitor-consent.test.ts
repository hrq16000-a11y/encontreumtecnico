import { describe, expect, it } from "vitest";
import {
  EUT_VISITOR_CONSENT_VERSION, makeCookieChoice, visitorConsentAllowed,
  publicPageKind, parseVisitorToken, VISITOR_TOKEN_TTL_MS,
} from "./visitor-consent";

describe("Fase 3 — consentimento específico e segregação de visitas", () => {
  it("não herda consentimento antigo de analytics nem aceita payload inválido", () => {
    for (const raw of [null, "", "not-json", '{"analytics":true}', '{"visitorAnalytics":true}',
      '{"visitorAnalytics":true,"version":"antiga"}']) expect(visitorConsentAllowed(raw)).toBe(false);
    expect(visitorConsentAllowed(JSON.stringify(makeCookieChoice({
      functional: false, analytics: false, advertising: false, presence: false, visitorAnalytics: true,
    })))).toBe(true);
  });
  it("escolha revogável separa publicidade, presença e dados de visita", () => {
    const allowed = makeCookieChoice({
      functional: false, analytics: false, advertising: false, presence: false, visitorAnalytics: false,
    }, new Date("2026-11-22T04:00:00Z"));
    expect(allowed).toEqual({
      necessary: true, functional: false, analytics: false, advertising: false, presence: false,
      visitorAnalytics: false, version: EUT_VISITOR_CONSENT_VERSION,
      decidedAt: "2026-11-22T04:00:00.000Z",
    });
    expect(visitorConsentAllowed(JSON.stringify(allowed))).toBe(false);
  });
  it("limita métricas a classes públicas, nunca URL privada ou query/token", () => {
    expect(publicPageKind("/")).toBe("home");
    expect(publicPageKind("/tecnicos")).toBe("directory");
    expect(publicPageKind("/servicos/rede-wifi")).toBe("services");
    for (const path of ["/admin", "/entrar", "/area-cliente", "/area-tecnico", "/tecnicos/slug",
      "/redefinir-senha", "/?token=abc", "/servicos/x?email=foo"]) {
      expect(publicPageKind(path)).toBeNull();
    }
  });
  it("token aleatório de sessão expira em 24h e não aceita campos arbitrários", () => {
    const token = "aabbccdd-1234-4333-8888-123456789abc";
    const raw = JSON.stringify({ token, issuedAt: 1000 });
    expect(parseVisitorToken(raw, 2000)?.token).toBe(token);
    expect(parseVisitorToken(raw, 1000 + VISITOR_TOKEN_TTL_MS)).toBeNull();
    expect(parseVisitorToken(JSON.stringify({ token: "IP:192.0.2.2", issuedAt: 1000 }), 2000)).toBeNull();
  });
});
