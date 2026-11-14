import { describe, expect, it } from "vitest";
import { canShareAnonymousPresence, countConsentedVisitorTabs } from "./visitor-realtime-presence";

describe("presença online opcional e sem identificação", () => {
  it("nunca aproveita consentimento antigo de analytics como consentimento de presença", () => {
    expect(canShareAnonymousPresence("/", null)).toBe(false);
    expect(canShareAnonymousPresence("/", "{invalid}")).toBe(false);
    expect(canShareAnonymousPresence("/", '{"analytics":true}')).toBe(false);
    expect(canShareAnonymousPresence("/", '{"presence":false,"analytics":true}')).toBe(false);
    expect(canShareAnonymousPresence("/", '{"presence":true,"analytics":false}')).toBe(true);
  });

  it("não transmite presença de áreas administrativas e contas privadas", () => {
    for (const path of ["/admin", "/admin/metricas", "/lp2/admin", "/lp2/admin-portal", "/lp2/meu-perfil", "/lp2/acompanhar", "/lp2/entrar", "/area-cliente", "/area-tecnico", "/entrar", "/acesso-contato/123", "/redefinir-senha"]) {
      expect(canShareAnonymousPresence(path, '{"presence":true}')).toBe(false);
    }
    expect(canShareAnonymousPresence("/tecnicos", '{"presence":true}')).toBe(true);
  });

  it("conta apenas abas válidas, sem usar dados pessoais de payloads arbitrários", () => {
    expect(countConsentedVisitorTabs({
      key1: [{ kind: "consented-visitor-tab" }],
      key2: [{ kind: "consented-visitor-tab" }, { kind: "consented-visitor-tab" }],
      key3: [{ kind: "other", ip: "192.0.2.1", user_id: "privado" }],
      broken: null,
    })).toBe(2);
  });
});
