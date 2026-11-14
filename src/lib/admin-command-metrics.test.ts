import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { adminCount, clientCounters, advertisingCounters } from "./admin-command-metrics";

describe("Rodada 1 — comando administrativo", () => {
  it("distingue erro de leitura e zero válido", () => {
    for (const input of [null, undefined, -1, "5", Infinity, 2.5]) expect(adminCount(input)).toBeNull();
    expect(adminCount(0)).toBe(0);
    expect(adminCount(8)).toBe(8);
    expect(clientCounters(null)).toEqual({ clients: null, unconfirmed: null });
    expect(advertisingCounters(null)).toEqual({ sponsors: null, campaigns: null, drafts: null });
  });
  it("extrai apenas contagens do RPC, sem dados pessoais", () => {
    const result = clientCounters({ clients_total: 32, clients_unconfirmed: 2, audit: [{ private: "masked" }] });
    expect(result).toEqual({ clients: 32, unconfirmed: 2 });
    expect(Object.keys(result)).toEqual(["clients", "unconfirmed"]);
  });
  it("conta somente rascunhos comerciais e não inventa campanhas", () => {
    expect(advertisingCounters({ sponsors: [{}], campaigns: [{ status: "draft" }, { status: "active" }],
      totals: { sponsors: 1, campaigns: 2 } })).toEqual({ sponsors: 1, campaigns: 2, drafts: 1 });
    expect(advertisingCounters({ sponsors: [], campaigns: [], totals: { sponsors: 0, campaigns: 0 } }))
      .toEqual({ sponsors: 0, campaigns: 0, drafts: 0 });
  });
  it("não apresenta como completo o subtotal de rascunhos quando o RPC pagina 100 campanhas", () => {
    const campaigns = Array.from({ length: 100 }, (_, i) => ({
      status: i < 10 ? "draft" : "active",
    }));
    expect(advertisingCounters({
      sponsors: [], campaigns,
      totals: { sponsors: 105, campaigns: 101 },
    })).toEqual({ sponsors: 105, campaigns: 101, drafts: null });
  });
  it("trata respostas de campanhas inconsistentes como indisponíveis", () => {
    expect(advertisingCounters({
      sponsors: [], campaigns: [{ id: "qa-fixture" }],
      totals: { sponsors: 3, campaigns: 1 },
    })).toEqual({ sponsors: 3, campaigns: 1, drafts: null });
    expect(advertisingCounters({
      sponsors: [], campaigns: [], totals: { sponsors: 0, campaigns: 0 },
    })).toEqual({ sponsors: 0, campaigns: 0, drafts: 0 });
  });
  it("consulta apenas contagens e RPCs existentes sob o gate administrativo", () => {
    const view = readFileSync("src/components/admin-command-overview.tsx", "utf8");
    const admin = readFileSync("src/routes/admin.tsx", "utf8");
    for (const mark of ['count: "exact", head: true', '"eut_admin_client_insights"', '"eut_ads_admin_snapshot"',
      '"Indisponível"', 'to="/admin/$secao"']) expect(view).toContain(mark);
    expect(view).not.toContain('.select("*")');
    expect(view).not.toContain(".insert(");
    expect(view).not.toContain(".update(");
    expect(view).not.toContain("service_role");
    expect(admin).toContain('roles.includes("admin")');
    expect(admin).toContain("<AdminCommandOverview />");
    expect(admin).toContain("<AdminControlHub />");
    expect(admin).toContain("<AdminClientInsights />");
    expect(admin).toContain("<AdminRequestQueue />");
    expect(admin).toContain("<AdminMessageQueue />");
    expect(admin).toContain("<AdminGlobalSearch />");
  });
});
