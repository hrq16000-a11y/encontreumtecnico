import { describe, expect, it } from "vitest";
import { accountScopedRows, canAcceptAccountResult } from "./account-scoped-queries";

describe("isolamento de solicitações entre contas", () => {
  it("nunca mostra pedidos da conta anterior durante troca de login", () => {
    const records = [{ id: "pedido-privado-1" }];
    expect(accountScopedRows(records, "usuario-a", "usuario-b")).toBeNull();
    expect(accountScopedRows(records, "usuario-a", null)).toBeNull();
    expect(accountScopedRows(records, "usuario-a", "usuario-a")).toEqual(records);
  });

  it("distingue lista própria vazia de dados ainda não carregados", () => {
    expect(accountScopedRows([], "usuario-a", "usuario-a")).toEqual([]);
    expect(accountScopedRows([], null, "usuario-a")).toBeNull();
    expect(accountScopedRows(null, "usuario-a", "usuario-a")).toBeNull();
  });

  it("ignora resposta antiga mesmo com o mesmo usuário e consulta nova", () => {
    expect(canAcceptAccountResult("usuario-a", "usuario-a", 4, 5)).toBe(false);
    expect(canAcceptAccountResult("usuario-a", "usuario-a", 5, 5)).toBe(true);
  });

  it("descarta requisição pendente após logout ou mudança de titular", () => {
    expect(canAcceptAccountResult("usuario-a", "usuario-b", 9, 9)).toBe(false);
    expect(canAcceptAccountResult("usuario-a", null, 9, 9)).toBe(false);
  });
});
