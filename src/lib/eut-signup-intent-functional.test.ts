// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSignupIntent, normalizeSignupIntent, readSignupIntent, rememberSignupIntent } from "./signup-intent";
import { authReturnUrl, EUT_CANONICAL_ORIGIN } from "./auth-domain";

beforeEach(() => sessionStorage.clear());

describe("QA #153 adaptada à main: intenção de cadastro nunca é privilégio", () => {
  it("guarda só preferência de técnico/cliente, sem aceitar papel admin", () => {
    expect(normalizeSignupIntent("admin")).toBeNull();
    expect(normalizeSignupIntent("tecnico")).toBe("tecnico");
    expect(normalizeSignupIntent("cliente")).toBe("cliente");
    rememberSignupIntent("tecnico");
    expect(readSignupIntent()).toBe("tecnico");
    rememberSignupIntent("cliente");
    expect(readSignupIntent()).toBe("cliente");
    clearSignupIntent();
    expect(readSignupIntent()).toBeNull();
  });

  it("ignora intenção corrompida ou valor desconhecido", () => {
    sessionStorage.setItem("eut-signup-intent", "admin");
    expect(readSignupIntent()).toBeNull();
    sessionStorage.setItem("eut-signup-intent", "tecnico,admin");
    expect(readSignupIntent()).toBeNull();
  });

  it("não interrompe o cadastro quando o navegador bloqueia sessionStorage", () => {
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    try {
      expect(() => rememberSignupIntent("tecnico")).not.toThrow();
      // Sem persistência local, a intenção continua uma preferência, nunca um papel.
      expect(readSignupIntent()).toBeNull();
    } finally {
      blocked.mockRestore();
    }
  });

  it("recusa origem de callback arbitrária mesmo com intenção armazenada", () => {
    rememberSignupIntent("cliente");
    expect(authReturnUrl("/entrar", "https://login.evil.invalid"))
      .toBe(EUT_CANONICAL_ORIGIN + "/entrar");
    expect(readSignupIntent()).toBe("cliente");
  });
});
