import { describe, expect, it } from "vitest";
import { clearOAuthErrorParams, hasOAuthCallbackError } from "./oauth-return-error";

describe("erro de retorno Google OAuth", () => {
  it("captura erros no query e no fragmento", () => {
    expect(hasOAuthCallbackError("?error=access_denied", "")).toBe(true);
    expect(hasOAuthCallbackError("", "#error_code=provider_error&error_description=Denied")).toBe(true);
    expect(hasOAuthCallbackError("", "#access_token=opaque-token&type=bearer")).toBe(false);
  });

  it("remove somente erros sem perder parâmetros legítimos", () => {
    expect(clearOAuthErrorParams({
      pathname: "/entrar",
      search: "?next=%2Farea-tecnico&error=access_denied",
      hash: "#error_code=provider_error&state=opaque",
    })).toBe("/entrar?next=%2Farea-tecnico#state=opaque");
  });

  it("não transforma uma sessão normal em erro", () => {
    expect(hasOAuthCallbackError("", "")).toBe(false);
    expect(hasOAuthCallbackError("?next=%2Farea-cliente", "#state=opaque")).toBe(false);
  });
});
