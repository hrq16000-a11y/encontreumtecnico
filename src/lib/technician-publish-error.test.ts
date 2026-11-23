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
    expect(technicianPublishErrorMessage({ code: "P0001" })).toMatch(/regra do cadastro/);
  });
  it("não apresenta verificação de e-mail por erro legado nem vaza detalhes internos", () => {
    const raw = "confirmed technician session required; private@example.com";
    const feedback = technicianPublishErrorMessage({ code: "P0001", message: raw });
    expect(feedback).toMatch(/condição de acesso antiga/);
    expect(feedback).not.toMatch(/titularidade do e-mail|OTP|verificação por SMS/i);
    expect(feedback).not.toContain(raw);
    expect(feedback).not.toContain("private@example.com");
  });
  it("não exibe mensagem SQL, detalhes nem códigos arbitrários", () => {
    const raw = "password=secret; SELECT * FROM private_users";
    expect(technicianPublishErrorMessage({ code: "xx';DROP TABLE--", message: raw })).not.toContain(raw);
    expect(technicianPublishErrorMessage({ code: "xx';DROP TABLE--", message: raw })).not.toContain("DROP");
    expect(technicianPublishErrorMessage({ code: "PGRST999", message: raw })).toContain("PGRST999");
  });
});
