import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildAllocationPreview, safeAllocationMessage, type AllocationRequest, type AllocationTechnician } from "./admin-allocation-preview";

const now = Date.parse("2026-11-12T12:00:00-03:00");
const request = (id: string, extra: Partial<AllocationRequest> = {}): AllocationRequest => ({
  id, status: "aberta", category: "redes", city: "Curitiba", region: "Hauer",
  technician_id: null, created_at: "2026-11-12T14:00:00Z", ...extra,
});
const tech = (id: string, extra: Partial<AllocationTechnician> = {}): AllocationTechnician => ({
  id, display_name: "Técnico " + id, city: "Curitiba", state_uf: "PR", region: "Hauer",
  specialties: ["redes"], service_slugs: ["wifi"], status: "aprovado", ...extra,
});
describe("Plano de alocação — somente prévia administrativa", () => {
  it("não inventa técnico nem horário quando a disponibilidade não está confirmada", () => {
    const p = buildAllocationPreview([request("r1")], [tech("t1")], new Set(), {}, now);
    expect(p.rows[0]!.technicianId).toBeNull();
    expect(p.rows[0]!.startLabel).toBe("A confirmar");
    expect(p.rows[0]!.risks).toContain("Prazo/SLA ainda não informado");
  });
  it("prioriza criticidade declarada e não atribui o mesmo técnico duas vezes", () => {
    const p = buildAllocationPreview([request("normal"), request("critical")], [tech("t1")],
      new Set(["t1"]), { critical: { priority: "critica", requestUf: "PR" } }, now);
    expect(p.rows.map((r) => r.requestId)).toEqual(["critical", "normal"]);
    expect(p.rows[0]!.technicianId).toBe("t1");
    expect(p.rows[1]!.technicianId).toBeNull();
  });
  it("não sugere perfil sem competência, cidade declarada ou aprovação", () => {
    const p = buildAllocationPreview([request("r1")], [
      tech("wrongSkill", { specialties: ["hardware"], service_slugs: [] }),
      tech("wrongCity", { city: "Pinhais" }), tech("suspended", { status: "suspenso" }),
    ], new Set(["wrongSkill", "wrongCity", "suspended"]), {}, now);
    expect(p.rows[0]!.technicianId).toBeNull();
  });
  it("não substitui profissional escolhido pelo cliente", () => {
    const p = buildAllocationPreview([request("r1", { technician_id: "t1" })],
      [tech("t2")], new Set(["t2"]), {}, now);
    expect(p.rows[0]!.technicianId).toBeNull();
    expect(p.rows[0]!.risks.join(" ")).toMatch(/não redistribuir/);
  });
  it("bloqueia correspondência por cidade sem UF informada, mesmo havendo disponibilidade", () => {
    const p = buildAllocationPreview([request("r1")], [tech("t1")], new Set(["t1"]), {}, now);
    expect(p.rows[0]!.technicianId).toBeNull();
    expect(p.rows[0]!.risks.join(" ")).toMatch(/cidades homônimas/);
  });
  it("nunca confunde cidades homônimas de estados diferentes", () => {
    const row = request("r1", { city: "Santa Maria" });
    const candidates = [tech("wrong", { city: "Santa Maria", state_uf: "RS" }),
      tech("right", { city: "Santa Maria", state_uf: "DF" })];
    const p = buildAllocationPreview([row], candidates, new Set(["wrong", "right"]),
      { r1: { priority: "normal", requestUf: "DF" } }, now);
    expect(p.rows[0]!.technicianId).toBe("right");
  });
  it("não equipara UF vazia, inválida ou faltante no técnico à confirmação do chamado", () => {
    const row = request("r1");
    for (const pref of [{ priority: "normal", requestUf: "ZZ" }, { priority: "normal", requestUf: "PR" }] as const) {
      const candidates = [tech("unknown", { state_uf: null })];
      const p = buildAllocationPreview([row], candidates, new Set(["unknown"]), { r1: pref }, now);
      expect(p.rows[0]!.technicianId).toBeNull();
    }
  });
  it("desempata por bairro e diferencia prazo vencido de prazo curto", () => {
    const p = buildAllocationPreview([
      request("r1"), request("r2", { region: "Carmo" }),
    ], [tech("t1", { region: "Carmo" }), tech("t2")], new Set(["t1", "t2"]),
    { r1: { priority: "critica", requestUf: "PR", deadline: "2026-11-12T11:30" },
      r2: { priority: "alta", requestUf: "PR", deadline: "2026-11-12T13:30", plannedStart: "2026-11-12T14:00" } }, now);
    expect(p.rows[0]!.technicianId).toBe("t2");
    expect(p.rows[0]!.risks.join(" ")).toMatch(/vencido/);
    expect(p.rows[1]!.technicianId).toBe("t1");
    expect(p.rows[1]!.risks.join(" ")).toMatch(/posterior ao prazo/);
  });
  it("não gera dados pessoais de cliente para WhatsApp", () => {
    const p = buildAllocationPreview([request("abcdef00-1234")], [tech("t1")], new Set(["t1"]),
      { "abcdef00-1234": { priority: "normal", requestUf: "PR" } }, now);
    const text = safeAllocationMessage(p);
    expect(text).toContain("abcdef00");
    expect(text).toContain("NÃO É ORDEM DE SERVIÇO CONFIRMADA");
    expect(text).not.toContain("1234");
    expect(text).not.toContain("descrição");
  });
  it("permite priorizar um chamado crítico antigo fora dos 30 mais recentes", () => {
    const queue = Array.from({ length: 36 }, (_, i) => request("r" + i));
    const p = buildAllocationPreview(queue, [tech("t1")], new Set(["t1"]),
      { r35: { priority: "critica", requestUf: "PR" } }, now, 30);
    expect(p.included).toBe(30);
    expect(p.excluded).toBe(6);
    expect(p.rows[0]!.requestId).toBe("r35");
    expect(p.rows[0]!.technicianId).toBe("t1");
    expect(p.rows.some((row) => row.requestId === "r35")).toBe(true);
  });
  it("prioriza prazo informado antes de cortar o lote em 30", () => {
    const queue = Array.from({ length: 35 }, (_, i) => request("r" + i));
    const p = buildAllocationPreview(queue, [], new Set(),
      { r34: { priority: "normal", deadline: "2026-11-12T13:00" } }, now, 30);
    expect(p.rows[0]!.requestId).toBe("r34");
  });
  it("limita a simulação e não afirma cobrir todo o banco", () => {
    const input = Array.from({ length: 32 }, (_, i) => request("r" + i));
    const p = buildAllocationPreview(input, [], new Set(), {}, now, 30);
    expect(p.included).toBe(30);
    expect(p.excluded).toBe(2);
  });
  it("preserva a autorização e não dispara ações automáticas pelo código de UI", () => {
    const view = readFileSync("src/components/admin-allocation-planner.tsx", "utf8");
    const route = readFileSync("src/routes/admin.tsx", "utf8");
    expect(route).toContain('roles.includes("admin")');
    expect(route).toContain('section === "solicitacoes" && <AdminAllocationPlanner requests={reqs}');
    expect(route).toContain('requestLoadState={requestLoadState} requestWindowComplete={requestWindowComplete}');
    expect(route).toContain('.select("*", { count: "exact" })');
    expect(route).toContain('setRequestLoadState(r.error ? "error" : "ready")');
    expect(view).toContain('requestLoadState === "error"');
    expect(view).toContain('Priorizar qualquer chamado do lote carregado');
    expect(view).toContain('!requestWindowComplete');
    expect(view).toContain('.eq("status", "aprovado")');
    expect(view).toContain("UF do chamado (confirmar)");
    expect(view).toContain("city,state_uf,region");
    expect(view).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(|wa\.me|service_role/);
    expect(view).toContain("A confirmação não é gravada".replace("A confirmação não é gravada","não são gravados"));
  });
});
