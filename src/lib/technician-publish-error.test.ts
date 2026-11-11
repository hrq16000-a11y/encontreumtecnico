import { describe, expect, it } from "vitest";
import { technicianPublishErrorMessage } from "./technician-publish-error";

describe("Falhas de publicação sem exposição de dados privados", () => {
  it("diferencia erro de sessão e permissão", () => {
    expect(technicianPublishErrorMessage({ code: "42501", message: "sensitive-table" })).toMatch(/autorização/);
    expect(technicianPublishErrorMessage({ code: "PGRST301" })).toMatch(/Entre novamente/);
  });
  it("orienta quando a RPC está ausente sem prometer publicação", () => {
    expect(technicianPublishErrorMessage({ code: "PGRST202" })).toMatch(/indisponível/);
    expect(technicianPublishErrorMessage({ code: "42883" })).toMatch(/não altere seus dados/i);
  });
  it("detecta registro existente e falha de integridade", () => {
    expect(technicianPublishErrorMessage({ code: "23505" })).toMatch(/Já existe/);
    expect(technicianPublishErrorMessage({ code: "23514" })).toMatch(/município/);
  });
  it("não exibe mensagem SQL, detalhes nem códigos arbitrários", () => {
    const raw = "password=secret; SELECT * FROM private_users";
    expect(technicianPublishErrorMessage({ code: "xx';DROP TABLE--", message: raw })).not.toContain(raw);
    expect(technicianPublishErrorMessage({ code: "xx';DROP TABLE--", message: raw })).not.toContain("DROP");
    expect(technicianPublishErrorMessage({ code: "PGRST999", message: raw })).toContain("PGRST999");
  });
});
