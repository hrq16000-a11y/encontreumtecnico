// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockDb = vi.hoisted(() => ({
  rpc: vi.fn(),
  legacyCount: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockDb.rpc(...args),
    from(table: string) {
      if (table !== "legacy_review_profiles") throw new Error("Unexpected table: " + table);
      let filters = 0;
      const query = {
        select: () => query,
        eq: () => {
          filters += 1;
          return filters === 2 ? mockDb.legacyCount() : query;
        },
      };
      return query;
    },
  },
}));

import { AdminClientInsights } from "./admin-client-insights";

const snapshot = {
  clients_total: 7,
  clients_confirmed: 5,
  clients_unconfirmed: 2,
  clients_restricted: 1,
  pending_client_invites: 0,
  audit_total: 1,
  audit_page: 0,
  audit_page_size: 20,
  audit: [{
    id: 91,
    created_at: "2026-11-22T12:00:00Z",
    kind: "contas",
    action: "Conta administrativa verificada",
    subject_user_id: null,
    reason: "Auditoria de teste sem dados pessoais",
  }],
};

function card(label: string): string {
  return screen.getByText(label).parentElement?.textContent ?? "";
}

beforeEach(() => {
  mockDb.rpc.mockReset();
  mockDb.legacyCount.mockReset();
  mockDb.rpc.mockResolvedValue({ data: snapshot, error: null });
});
afterEach(cleanup);

describe("clientes: falha isolada na contagem de fichas históricas", () => {
  it("preserva os indicadores autorizados e o histórico quando a leitura legada responde com erro", async () => {
    mockDb.legacyCount.mockResolvedValue({ count: null, error: { message: "unavailable" } });
    render(<AdminClientInsights />);

    expect(await screen.findByText("Conta administrativa verificada")).toBeTruthy();
    expect(screen.getByText(/Contagem das fichas importadas indisponível/)).toBeTruthy();
    expect(card("Contas de clientes vinculadas")).toContain("7");
    expect(card("E-mails confirmados")).toContain("5");
    expect(card("Registros de clientes sob gestão")).toContain("Indisponível");
    expect(card("Fichas importadas gerenciáveis")).toContain("Indisponível");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mockDb.rpc).toHaveBeenCalledWith("eut_admin_client_insights", {
      _audit_filter: "todos", _page: 0, _subject_user_id: null,
    });
  });

  it("não descarta a RPC se a busca legada rejeitar, e recupera o total no Atualizar", async () => {
    mockDb.legacyCount.mockRejectedValueOnce(new Error("offline"));
    mockDb.legacyCount.mockResolvedValue({ count: 3, error: null });
    render(<AdminClientInsights />);

    expect(await screen.findByText(/Contagem das fichas importadas indisponível/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(card("Registros de clientes sob gestão")).toContain("10"));
    expect(card("Fichas importadas gerenciáveis")).toContain("3");
    expect(screen.queryByText(/Contagem das fichas importadas indisponível/)).toBeNull();
    expect(screen.getByText("Conta administrativa verificada")).toBeTruthy();
  });

  it("continua bloqueando números e auditoria quando a própria RPC administrativa falha", async () => {
    mockDb.rpc.mockResolvedValue({ data: null, error: { message: "unauthorized" } });
    mockDb.legacyCount.mockResolvedValue({ count: 4, error: null });
    render(<AdminClientInsights />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent",
      "Não foi possível confirmar os indicadores e o histórico. Tente atualizar.");
    expect(screen.queryByText("Contas de clientes vinculadas")).toBeNull();
    expect(screen.queryByText("Conta administrativa verificada")).toBeNull();
  });
});
