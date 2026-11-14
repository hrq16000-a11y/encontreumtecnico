// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockDb = vi.hoisted(() => ({
  requests: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  ranges: [] as Array<{ table: string; start: number; end: number }>,
  updates: 0,
  delayNextMessageQuery: null as Promise<void> | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      let statusFilter: string | null = null;
      let idFilter: string | null = null;
      let change: Record<string, unknown> | null = null;
      const records = () => table === "service_requests" ? mockDb.requests : mockDb.messages;
      const builder = {
        select: () => builder,
        update(value: Record<string, unknown>) { change = value; return builder; },
        eq(field: string, value: string) {
          if (field === "status") statusFilter = value;
          if (field === "id") idFilter = value;
          return builder;
        },
        or: () => builder,
        order: () => builder,
        async range(start: number, end: number) {
          mockDb.ranges.push({ table, start, end });
          const rows = records().filter((r) =>
            (!statusFilter || r["status"] === statusFilter) && (!idFilter || r["id"] === idFilter));
          if (table === "contact_messages" && mockDb.delayNextMessageQuery) {
            const delay = mockDb.delayNextMessageQuery;
            mockDb.delayNextMessageQuery = null;
            await delay;
          }
          return { data: rows.slice(start, end + 1), count: rows.length, error: null };
        },
        async maybeSingle() {
          return { data: records().find((r) => r["id"] === idFilter) ?? null, error: null };
        },
        async single() {
          const row = records().find((r) => r["id"] === idFilter);
          if (!row || !change) return { data: null, error: { message: "No row" } };
          Object.assign(row, change);
          mockDb.updates++;
          return { data: { id: row["id"], status: row["status"] }, error: null };
        },
      };
      return builder;
    },
  },
}));

import { AdminRequestQueue } from "./admin-request-queue";
import { AdminMessageQueue } from "./admin-message-queue";

beforeEach(() => {
  mockDb.requests = [];
  mockDb.messages = [];
  mockDb.ranges = [];
  mockDb.updates = 0;
  mockDb.delayNextMessageQuery = null;
  window.history.replaceState({}, "", "/admin");
});
afterEach(() => cleanup());

describe("filas administrativas em interação real de React", () => {
  it("pagina 25 solicitações e mantém o registro histórico alcançável por link direto", async () => {
    const oldId = "78af4122-a5c7-4f2b-8c32-f88bc7899b00";
    mockDb.requests = Array.from({ length: 25 }, (_, i) => ({
      id: i === 24 ? oldId : `item-${i}`,
      title: i === 24 ? "Pedido histórico" : `Pedido ${i + 1}`,
      category: "Informática", city: "Curitiba", region: null,
      status: "aberta", description: "Descrição do problema",
      created_at: "2026-11-14T00:00:00Z",
    }));
    window.history.replaceState({}, "", `/admin/solicitacoes?registro=${oldId}`);
    render(<AdminRequestQueue />);
    expect(await screen.findByText("Pedido histórico")).toBeTruthy();
    expect(mockDb.ranges.some(({ start, end }) => start === 0 && end === 19)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Voltar à lista" }));
    expect(window.location.search).not.toContain("registro=");
    expect(await screen.findByText("Pedido 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Próxima/ }));
    await waitFor(() => expect(mockDb.ranges.some(({ start, end }) => start === 20 && end === 39)).toBe(true));
    expect(await screen.findByText("Pedido 21")).toBeTruthy();
  });

  it("só confirma atualização de mensagem após retorno persistente do banco", async () => {
    mockDb.messages = [{ id: "msg-1", name: "Cliente", subject: "Preciso de atendimento",
      status: "nova", email: "cliente@example.test", message: "Mensagem", created_at: "2026-11-14T00:00:00Z" }];
    render(<AdminMessageQueue />);
    expect(await screen.findByText("Preciso de atendimento")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Marcar respondida/ }));
    expect(await screen.findByText("Situação da mensagem atualizada e confirmada no banco.")).toBeTruthy();
    expect(mockDb.messages[0]?.["status"]).toBe("respondida");
    expect(mockDb.updates).toBe(1);
  });

  it("não mantém ações antigas clicáveis enquanto o filtro de mensagens carrega", async () => {
    mockDb.messages = [{ id: "msg-1", name: "Cliente", subject: "Mensagem nova",
      status: "nova", email: "cliente@example.test", message: "Conteúdo", created_at: "2026-11-14T00:00:00Z" }];
    render(<AdminMessageQueue />);
    expect(await screen.findByText("Mensagem nova")).toBeTruthy();

    let liberar!: () => void;
    mockDb.delayNextMessageQuery = new Promise<void>((resolve) => { liberar = resolve; });
    fireEvent.change(screen.getByRole("combobox", { name: "Situação" }), { target: { value: "respondida" } });
    expect(screen.getByText("Carregando…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Arquivar" })).toBeNull();
    expect(screen.queryByText("Mensagem nova")).toBeNull();
    liberar();
    expect(await screen.findByText("Nenhuma mensagem para este filtro.")).toBeTruthy();
    expect(mockDb.updates).toBe(0);
  });

  it("limpa a URL da mensagem localizada ao voltar à lista", async () => {
    const id = "1c265cd4-0cc8-47e9-84ad-2603f337d927";
    mockDb.messages = [{ id, name: "Teste", subject: "Mensagem localizada", status: "nova",
      email: "teste@example.test", message: "Conteúdo", created_at: "2026-11-14T00:00:00Z" }];
    window.history.replaceState({}, "", `/admin/mensagens?registro=${id}`);
    render(<AdminMessageQueue />);
    expect(await screen.findByText("Mensagem localizada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voltar à lista" }));
    expect(window.location.search).toBe("");
    await waitFor(() => expect(screen.queryByText("Registro localizado pela pesquisa global.")).toBeNull());
  });
});
