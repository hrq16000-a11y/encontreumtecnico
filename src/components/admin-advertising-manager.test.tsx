// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mockDb = vi.hoisted(() => ({
  snapshot: {} as Record<string, unknown>,
  actions: [] as Array<{ name: string; args?: Record<string, unknown> }>,
  staleWrite: false,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    async rpc(name: string, args?: Record<string, unknown>) {
      if (name === "eut_ads_admin_snapshot") {
        return { data: JSON.parse(JSON.stringify(mockDb.snapshot)), error: null };
      }
      if (name === "eut_ads_admin_save") {
        mockDb.actions.push(args ? { name, args } : { name });
        if (args?.["_kind"] === "pause_campaign") {
          if (!mockDb.staleWrite) {
            const campaign = (mockDb.snapshot["campaigns"] as Array<Record<string, unknown>>)
              .find((row) => row["id"] === (args?.["_data"] as Record<string, unknown>)?.["id"]);
            if (campaign) campaign["status"] = "paused";
          }
          return { data: { saved: true, kind: "pause_campaign", id: "campaign-1" }, error: null };
        }
        const payload = (args?.["_data"] ?? {}) as Record<string, unknown>;
        const savedId = String(payload["id"] || "sponsor-new");
        if (!mockDb.staleWrite) {
          const rows = mockDb.snapshot["sponsors"] as Array<Record<string, unknown>>;
          const current = rows.find((row) => row["id"] === savedId);
          if (current) Object.assign(current, payload);
          else rows.unshift({ ...payload, id: savedId });
        }
        return { data: { saved: true, kind: "sponsor", id: savedId }, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
  },
}));

import { AdminAdvertisingManager } from "./admin-advertising-manager";

beforeEach(() => {
  mockDb.snapshot = {
    sponsors: Array.from({ length: 18 }, (_, i) => ({
      id: `sponsor-${i + 1}`, brand_name: i === 17 ? "Única Marca" : `Marca ${i + 1}`,
      status: i % 2 === 0 ? "contracted" : "prospect", created_at: `2026-11-${String(18 - i).padStart(2, "0")}T12:00:00Z`,
    })),
    placements: [],
    campaigns: [{ id: "campaign-1", title: "Campanha Interna", status: "active", created_at: "2026-11-11T12:00:00Z" }],
    creatives: [], assignments: [],
    totals: { sponsors: 18, placements: 0, campaigns: 1, creatives: 0, assignments: 0 },
  };
  mockDb.actions = [];
  mockDb.staleWrite = false;
  window.history.replaceState({}, "", "/admin/patrocinadores");
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("gestão administrativa de publicidade", () => {
  it("busca e filtra dados reais da consulta com paginação de 15 por página", async () => {
    render(<AdminAdvertisingManager />);
    const list = await screen.findByRole("heading", { name: "Registros existentes" });
    const records = list.parentElement!;
    expect(within(records).getByText("Página 1 de 2")).toBeTruthy();
    expect(within(records).getAllByRole("button", { name: "Editar" })).toHaveLength(15);
    fireEvent.change(within(records).getByRole("textbox", { name: "Localizar registro" }), {
      target: { value: "Unica Marca" },
    });
    expect(within(records).getByText("Única Marca")).toBeTruthy();
    expect(within(records).getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    fireEvent.change(within(records).getByRole("combobox", { name: "Situação" }), {
      target: { value: "contracted" },
    });
    expect(within(records).getByText("Nenhum registro corresponde aos filtros.")).toBeTruthy();
    expect(mockDb.actions).toHaveLength(0);
  });

  it("abre resultado global na aba correta e não afirma sucesso sem reler o registro", async () => {
    mockDb.staleWrite = true;
    window.history.replaceState({}, "", "/admin/patrocinadores?busca=Campanha&area=campaigns");
    render(<AdminAdvertisingManager />);
    await screen.findByRole("tab", { name: "Campanhas" });
    expect(screen.getByRole("tab", { name: "Campanhas" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Localizar registro" })).toHaveProperty("value", "Campanha");
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Não foi possível pausar"));
    expect(mockDb.actions).toHaveLength(1);
  });

  it("confirma no snapshot uma pausa real do RPC antes de informar sucesso", async () => {
    render(<AdminAdvertisingManager />);
    await screen.findByRole("tab", { name: "Campanhas" });
    fireEvent.click(screen.getByRole("tab", { name: "Campanhas" }));
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    await screen.findByText("Campanha pausada e estado persistido confirmado.");
    expect((mockDb.snapshot["campaigns"] as Array<Record<string, unknown>>)[0]?.["status"]).toBe("paused");
    expect(mockDb.actions[0]?.args?.["_kind"]).toBe("pause_campaign");
  });

  it("não considera edição persistida quando o snapshot ainda contém os valores antigos", async () => {
    mockDb.staleWrite = true;
    render(<AdminAdvertisingManager />);
    const list = (await screen.findByRole("heading", { name: "Registros existentes" })).parentElement!;
    fireEvent.change(within(list).getByRole("textbox", { name: "Localizar registro" }), {
      target: { value: "Marca 1" },
    });
    fireEvent.click(within(within(list).getByText("Marca 1").closest("li")!).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome da marca *" }), {
      target: { value: "Marca Alterada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar no banco" }));
    await screen.findByText(/dados alterados não foram confirmados/);
    expect(mockDb.actions[0]?.args?.["_kind"]).toBe("sponsor");
    expect((mockDb.snapshot["sponsors"] as Array<Record<string, unknown>>)[0]?.["brand_name"]).toBe("Marca 1");
  });

  it("confirma edição dos campos de cadastro depois da releitura", async () => {
    render(<AdminAdvertisingManager />);
    const list = (await screen.findByRole("heading", { name: "Registros existentes" })).parentElement!;
    fireEvent.change(within(list).getByRole("textbox", { name: "Localizar registro" }), {
      target: { value: "Marca 1" },
    });
    fireEvent.click(within(within(list).getByText("Marca 1").closest("li")!).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome da marca *" }), {
      target: { value: "Marca Alterada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar no banco" }));
    await screen.findByText(/Registro salvo e consultado novamente/);
    expect((mockDb.snapshot["sponsors"] as Array<Record<string, unknown>>)[0]?.["brand_name"]).toBe("Marca Alterada");
  });
});
