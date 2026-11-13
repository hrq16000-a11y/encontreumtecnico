import { describe, expect, it } from "vitest";
import { prepareTechnicianIngest, type TechnicianInput, type ExistingSource } from "./technician-ingest-contract";

const record = (change: Partial<TechnicianInput> = {}): TechnicianInput => ({
  origin: "wordpress", sourceId: "legacy:123", phone: "(41) 99999-8888", ...change,
});
const known = (change: Partial<ExistingSource> = {}): ExistingSource => ({
  technicianId: "8310875c-341b-4a0c-92d3-bdccdd8d9381",
  origin: "wordpress", sourceId: "legacy:123",
  phoneE164: "+5541999998888", enabled: true, blocked: false, ...change,
});

describe("catálogo canônico: preparação server-only e fixtures sintéticas", () => {
  it("entrada com telefone mínimo nasce habilitada, sem Auth, cidade ou especialidade inventada", () => {
    const { privateWrites, summary } = prepareTechnicianIngest([record()], []);
    expect(summary.creates).toBe(1);
    expect(privateWrites[0]).toEqual({
      operation: "create", technicianId: null, origin: "wordpress", sourceId: "legacy:123",
      phoneE164: "+5541999998888", ddd: "41", displayName: null,
      officialCity: null, enabled: true,
    });
    expect(JSON.stringify(summary)).not.toMatch(/99999|8888|legacy:123/);
  });
  it("respeita município IBGE informado e não infere localização por DDD", () => {
    const city = { ibgeId: 4125506, name: "São José dos Pinhais", uf: "PR" };
    const a = prepareTechnicianIngest([record({ displayName: "Oficina Alfa", officialCity: city })], []);
    expect(a.privateWrites[0]?.officialCity).toEqual(city);
    expect(a.privateWrites[0]?.displayName).toBe("Oficina Alfa");
    const b = prepareTechnicianIngest([record({ officialCity: { ibgeId: 0, name: "X", uf: "XX" } })], []);
    expect(b.summary.rejected).toBe(1);
  });
  it("não cria conta fictícia nem exige reivindicação", () => {
    const r = prepareTechnicianIngest([record({ origin: "manual" })], []);
    expect(r.privateWrites[0]?.enabled).toBe(true);
    expect(JSON.stringify(r.privateWrites[0])).not.toMatch(/userId|auth|claimed|confirmed|pending/);
  });
  it("deduplica telefone reformatado para o mesmo ID externo", () => {
    const r = prepareTechnicianIngest([record(),record({ phone: "+55 (41) 99999-8888" })], []);
    expect(r.summary).toMatchObject({ creates: 1, deduplicated: 1, quarantined: 0 });
    expect(r.privateWrites).toHaveLength(1);
  });
  it("quarentena fontes conflitantes sem travar outros registros", () => {
    const r = prepareTechnicianIngest([
      record(), record({ phone: "(41) 98888-7777" }),
      record({ sourceId: "other", phone: "41 97777-6666" }),
    ], []);
    expect(r.summary).toMatchObject({ creates: 1, quarantined: 2 });
    expect(r.privateWrites).toHaveLength(1);
  });
  it("não junta pessoas com mesmo telefone, nem na mesma importação", () => {
    const r = prepareTechnicianIngest([record(),record({ origin: "external", sourceId: "g:2" })], []);
    expect(r.summary.quarantined).toBe(2);
    expect(r.privateWrites).toHaveLength(0);
  });
  it("não vincula outra origem ao técnico existente por telefone compartilhado", () => {
    const r = prepareTechnicianIngest([record({ origin: "external", sourceId: "g:2" })], [known()]);
    expect(r.summary.quarantined).toBe(1);
    expect(r.privateWrites).toHaveLength(0);
  });
  it("reimportar nunca reabilita registro desabilitado pelo admin", () => {
    const r = prepareTechnicianIngest([record()], [known({ enabled: false })]);
    expect(r.summary).toMatchObject({ creates: 0, updates: 1 });
    expect(r.privateWrites[0]?.enabled).toBe(false);
    expect(r.privateWrites[0]?.technicianId).toBe(known().technicianId);
  });
  it("banimento de identidade ou número impede entrada automática", () => {
    const a = prepareTechnicianIngest([record()], [known({ blocked: true })]);
    const b = prepareTechnicianIngest([record()], [], new Set(["+5541999998888"]));
    expect(a.summary.quarantined).toBe(1);
    expect(b.summary.quarantined).toBe(1);
    expect(a.privateWrites).toHaveLength(0);
    expect(b.privateWrites).toHaveLength(0);
  });
  it("recusa telefone inválido, ID de origem suspeito e divulgação de contato no nome", () => {
    const r = prepareTechnicianIngest([
      record({ phone: "99998888", sourceId: "invalid" }),
      record({ sourceId: "email@example.com" }),
      record({ displayName: "Contato +55 (41) 99999-8888" }),
    ], []);
    expect(r.privateWrites).toHaveLength(0);
    expect(r.summary.rejected).toBe(3);
  });
  it("processa lote misto independentemente e mantém resumo privado", () => {
    const r = prepareTechnicianIngest([
      record(), record({ sourceId: "other", phone: "41 98888-7777" }),
      record({ sourceId: "bad", phone: "123" }),
    ], []);
    expect(r.summary).toMatchObject({ creates: 2, rejected: 1, quarantined: 0 });
    expect(r.privateWrites).toHaveLength(2);
    expect(JSON.stringify(r.summary)).not.toMatch(/+5541|99999|8888|legacy:123/);
  });
  it("segunda passagem com mapeamento persistido prepara UPDATE e não CREATE", () => {
    const one = prepareTechnicianIngest([record()], []);
    const two = prepareTechnicianIngest([record()], [known()]);
    expect(one.summary.creates).toBe(1);
    expect(two.summary).toMatchObject({ creates: 0, updates: 1 });
    expect(two.privateWrites[0]?.technicianId).toBe(known().technicianId);
  });
});
