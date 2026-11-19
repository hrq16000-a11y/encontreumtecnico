import { describe, expect, it } from "vitest";
import { prepareTechnicianCsv } from "./admin-technician-csv-import";

const categories = [{ slug: "informatica", label: "Informática" }];

describe("importação real de técnicos sem dados inventados", () => {
  it("aceita CSV delimitado por ponto e vírgula, preserva nomes e gera idempotência", () => {
    const csv = 'nome;cidade;ddd;categoria;telefone\n"Empresa; Tecnologia";Curitiba;41;Informática;(41) 99999-9999\n';
    const rows = prepareTechnicianCsv(csv, categories);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      displayName: "Empresa; Tecnologia", regionApprox: "Curitiba", ddd: "41",
      categorySlugs: ["informatica"], phoneE164: "+5541999999999",
    });
    expect(prepareTechnicianCsv(csv, categories)[0]?.sourceId).toBe(rows[0]?.sourceId);
  });
  it("bloqueia dados inválidos antes de qualquer gravação", () => {
    expect(() => prepareTechnicianCsv("nome,telefone\nA,(41) 99999-9999", categories)).toThrow(/nome/);
    expect(() => prepareTechnicianCsv("nome;categoria\nEmpresa;categoria inventada", categories)).toThrow(/categoria/);
    expect(() => prepareTechnicianCsv("nome;cidade\nEmpresa;Curitiba\nNome", categories)).toThrow(/colunas/);
  });
  it("aceita cidade/UF e lotes grandes sem inventar município IBGE", () => {
    const header = "nome;cidade;telefone";
    const body = Array.from({ length: 5_000 }, (_, index) =>
      `Técnico ${index + 1};Santo André/SP;(11) 99999-${String(index).padStart(4, "0")}`);
    const rows = prepareTechnicianCsv([header, ...body].join("\n"), categories);
    expect(rows).toHaveLength(5_000);
    expect(rows[0]).toMatchObject({ declaredCity: "Santo André", declaredUf: "SP", cityIbgeId: null, lineNumber: 2 });
    expect(rows[4_999]?.lineNumber).toBe(5_001);
    expect(() => prepareTechnicianCsv([header, ...body, "Técnico Extra;Santo André/SP;(11) 99999-5000"].join("\n"), categories))
      .toThrow(/5\.000/);
  });
});
