import { describe, expect, it } from "vitest";
import {
  normalizeBrazilPhoneE164, prepareAdminTechnicianEdit, prepareReversibleArchive,
  type AdminCatalog, type AdminEditDraft, type AdminGuard,
} from "./admin-technician-crud-intent";

const CATALOG: AdminCatalog = {
  cities: [
    { id: 4125506, name: "São José dos Pinhais", uf: "PR" },
    { id: 4106902, name: "Curitiba", uf: "PR" },
    { id: 1200203, name: "Cruzeiro do Sul", uf: "AC" },
  ],
  categories: [
    { slug: "computadores", active: true },
    { slug: "redes", active: true },
    { slug: "removida", active: false },
  ],
  services: [
    { slug: "manutencao-pc", category_slug: "computadores", active: true },
    { slug: "wifi", category_slug: "redes", active: true },
    { slug: "inativo", category_slug: "computadores", active: false },
  ],
};
const UUID = "a6b49a98-c980-42a8-bc9d-78fd5a741e08";
const REV = "2026-11-11T17:13:20.000Z";
const GUARD: AdminGuard = { technicianStatus: "aprovado", accountBlocked: false, phoneBlocked: false };
const DRAFT: AdminEditDraft = {
  technicianId: UUID, expectedUpdatedAt: REV,
  reason: "Correção administrativa da cobertura",
  baseCityId: 4125506, coverageCityIds: [4125506, 4106902], radiusKm: 30,
  neighborhood: "Jardim Itália", categorySlugs: ["computadores","redes"],
  serviceSlugs: ["manutencao-pc","wifi"], phone: { kind: "keep" },
};
const prepare = (update: Partial<AdminEditDraft> = {}, guard: AdminGuard = GUARD) =>
  prepareAdminTechnicianEdit({ ...DRAFT, ...update }, CATALOG, guard);
const fail = (result: ReturnType<typeof prepareAdminTechnicianEdit>) =>
  result.ok ? [] : result.issues;

describe("P0 administração: validação local não substitui RBAC/RLS/SQL auditado", () => {
  it("normaliza telefones em E.164 sem confundir DDD 55 com país 55", () => {
    expect(normalizeBrazilPhoneE164("(41) 99999-8888")).toBe("+5541999998888");
    expect(normalizeBrazilPhoneE164("+55 41 99999-8888")).toBe("+5541999998888");
    expect(normalizeBrazilPhoneE164("(55) 99999-8888")).toBe("+5555999998888");
    expect(normalizeBrazilPhoneE164("419999")).toBeNull();
    expect(normalizeBrazilPhoneE164("00 41 99999-8888")).toBeNull();
  });
  it("seleciona município por IBGE, cobertura única, serviços ativos na categoria", () => {
    const result = prepare();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe("preview_only");
    expect(result.value.changes.city).toBe("São José dos Pinhais");
    expect(result.value.changes.uf).toBe("PR");
    expect(result.value.changes.coverageCityIds).toEqual([4125506,4106902]);
    expect(result.value.changes.serviceSlugs).toEqual(["manutencao-pc","wifi"]);
    expect(result.value.auditPreview.keepsExistingBlocks).toBe(true);
  });
  it("recusa município inventado, cidade-base fora da cobertura e mais de cinco cidades", () => {
    expect(fail(prepare({ baseCityId: 9999999 })).join(" ")).toMatch(/IBGE/);
    expect(fail(prepare({ coverageCityIds: [4106902] })).join(" ")).toMatch(/cidade-base/);
    expect(fail(prepare({ coverageCityIds: [4125506,4125506] })).join(" ")).toMatch(/repetições/);
    expect(fail(prepare({ coverageCityIds: [4125506,4106902,1200203,1,2,3] })).join(" ")).toMatch(/cinco/);
  });
  it("impede serviços desativados, categorias não autorizadas e duplicação", () => {
    expect(fail(prepare({ serviceSlugs: ["inativo"] })).join(" ")).toMatch(/serviços ativos/);
    expect(fail(prepare({ serviceSlugs: ["wifi"], categorySlugs: ["computadores"] })).join(" ")).toMatch(/serviços ativos/);
    expect(fail(prepare({ categorySlugs: ["removida"] })).join(" ")).toMatch(/especialidades/);
    expect(fail(prepare({ serviceSlugs: ["manutencao-pc","manutencao-pc"] })).join(" ")).toMatch(/duplicatas/);
  });
  it("não permite cobertura publicada em perfil pendente e exige revisão para gravação", () => {
    const pending = { ...GUARD, technicianStatus: "pendente" } as const;
    expect(fail(prepare({}, pending)).length).toBeGreaterThan(0);
    const ok = prepare({ coverageCityIds: [], radiusKm: null }, pending);
    expect(ok.ok).toBe(true);
    expect(fail(prepare({ expectedUpdatedAt: "unknown" })).join(" ")).toMatch(/revisão/);
  });
  it("banimentos não desaparecem nem autorizam divulgação ao trocar número", () => {
    const blocked = { ...GUARD, accountBlocked: true, phoneBlocked: true };
    const denied = prepare({ phone: {
      kind: "replace", input: "41 99999-8888", allowPaidContact: true,
    } }, blocked);
    expect(denied.ok).toBe(false);
    expect(fail(denied).join(" ")).toMatch(/bloqueado/);
    const allowed = prepare({ phone: {
      kind: "replace", input: "41 99999-8888", allowPaidContact: false,
    } }, blocked);
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.value.changes.phone).toEqual({
      kind: "replace", e164: "+5541999998888", allowPaidContact: false,
    });
    expect(allowed.value.auditPreview.phoneLast4).toBe("8888");
    expect(JSON.stringify(allowed.value.auditPreview)).not.toContain("+5541999998888");
    expect(allowed.value.auditPreview.keepsExistingBlocks).toBe(true);
  });
  it("não permite contatos no campo bairro nem motivo", () => {
    expect(fail(prepare({ neighborhood: "www.example.com" })).join(" ")).toMatch(/Bairro/);
    expect(fail(prepare({ reason: "Meu número é 41 99999-8888" })).join(" ")).toMatch(/Motivo/);
  });
  it("arquivo reversível não significa desbanimento, aprovação ou publicação", () => {
    const archive = prepareReversibleArchive({
      technicianId: UUID, expectedUpdatedAt: REV, reason: "Retirada administrativa",
      action: "archive", isArchived: false, accountBlocked: true, phoneBlocked: true,
    });
    expect(archive).toEqual({
      ok: true, kind: "preview_only", operation: "archive",
      willPublish: false, preservesBan: true,
    });
    expect(prepareReversibleArchive({
      technicianId: UUID, expectedUpdatedAt: REV, reason: "Reativação após revisão",
      action: "restore", isArchived: true, accountBlocked: true, phoneBlocked: true,
    })).toMatchObject({ ok: true, willPublish: false, preservesBan: true });
    expect(prepareReversibleArchive({
      technicianId: UUID, expectedUpdatedAt: REV, reason: "Arquivamento repetido",
      action: "archive", isArchived: true, accountBlocked: false, phoneBlocked: false,
    }).ok).toBe(false);
    // The archive marker is intentionally unreadable by the browser; server checks it.
    expect(prepareReversibleArchive({
      technicianId: UUID, expectedUpdatedAt: REV, reason: "Revisão administrativa",
      action: "restore", isArchived: null, accountBlocked: true, phoneBlocked: true,
    })).toMatchObject({ ok: true, willPublish: false, preservesBan: true });
  });
});
