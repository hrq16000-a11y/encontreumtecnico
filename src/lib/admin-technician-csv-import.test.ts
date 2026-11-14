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
});
