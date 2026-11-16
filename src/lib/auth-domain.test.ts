import { describe, expect, it } from "vitest";
import { authReturnOrigin, authReturnUrl, EUT_CANONICAL_ORIGIN } from "./auth-domain";

describe("OAuth retorna ao domínio oficial e preserva previews autorizados", () => {
  it.each([
    "https://www.encontreumtecnico.com.br",
    "https://encontreumtecnico.com.br",
    "https://www.encontreumtecnico.com",
    "https://encontreumtecnico.com",
    "https://encontreumtecnico-msolus.vercel.app",
    "https://encontreumtecnico.vercel.app",
    "https://outro-projeto-4fhjltbrw-msolus.vercel.app",
    "https://encontreumtecnico-4fhjltbrw-outraequipe.vercel.app",
  ])("seleciona .com.br oficial em %s", origin => {
    expect(authReturnOrigin(origin)).toBe(EUT_CANONICAL_ORIGIN);
    expect(authReturnUrl("/entrar", origin)).toBe("https://www.encontreumtecnico.com.br/entrar");
    expect(authReturnUrl("/redefinir-senha", origin))
      .toBe("https://www.encontreumtecnico.com.br/redefinir-senha");
  });
  it.each([
    "http://localhost:3000",
    "https://find-your-trusted-technician.lovable.app",
    "https://id-preview--123e4567-e89b-42d3-a456-426614174000.lovableproject.com",
    "https://encontreumtecnico-4fhjltbrw-msolus.vercel.app",
    "https://encontreumtecnico-9hhwqmhs4-msolus.vercel.app",
  ])("mantém um preview explícito sem redirecioná-lo para produção: %s", origin => {
    expect(authReturnOrigin(origin)).toBe(origin);
    expect(authReturnUrl("/entrar", origin)).toBe(`${origin}/entrar`);
  });
  it("não permite origem externa controlar o callback", () => {
    expect(authReturnOrigin("https://phishing.example")).toBe(EUT_CANONICAL_ORIGIN);
    expect(authReturnOrigin("https://encontreumtecnico-4fhjltbrw-msolus.vercel.app.evil.example"))
      .toBe(EUT_CANONICAL_ORIGIN);
    expect(authReturnOrigin("http://encontreumtecnico-4fhjltbrw-msolus.vercel.app"))
      .toBe(EUT_CANONICAL_ORIGIN);
    expect(authReturnOrigin("https://encontreumtecnico-4fhjltbrw-msolus.vercel.app:8443"))
      .toBe(EUT_CANONICAL_ORIGIN);
    expect(authReturnOrigin("not-a-url")).toBe(EUT_CANONICAL_ORIGIN);
  });
});
