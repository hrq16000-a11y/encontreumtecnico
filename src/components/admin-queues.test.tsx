// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockDb = vi.hoisted(() => ({
  requests: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  ranges: [] as Array<{ table: string; start: number; end: number }>,
  updates: 0,
  directUpdates: 0,
  audits: [] as Array<{ id: string; status: string; reason: string }>,
  delayNextMessageQuery: null as Promise<void> | null,
  delayNextMessageRpc: null as Promise<void> | null,
  failNextMessageRead: false,
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
          // Supabase returns a JSON snapshot, not references to mutable fixture rows.
          return { data: rows.slice(start, end + 1).map((row) => ({ ...row })), count: rows.length, error: null };
        },
        async maybeSingle() {
          return { data: records().find((r) => r["id"] === idFilter) ?? null, error: null };
        },
        async single() {
          if (table === "contact_messages" && mockDb.failNextMessageRead) {
            mockDb.failNextMessageRead = false;
            return { data: null, error: { message: "Temporary read failure" } };
          }
          const row = records().find((r) => r["id"] === idFilter);
          if (!row) return { data: null, error: { message: "No row" } };
          if (change) { Object.assign(row, change); mockDb.directUpdates++; }
          return { data: { id: row["id"], status: row["status"] }, error: null };
        },
      };
      return builder;
    },
    async rpc(functionName: string, params: Record<string, unknown>) {
      if (functionName !== "eut_admin_contact_action" || params["_action"] !== "mark_message")
        return { data: null, error: { message: "RPC não autorizada" } };
      const row = mockDb.messages.find((message) => message["id"] === params["_message_id"]);
      const reason = params["_reason"];
      if (!row || typeof reason !== "string" || reason.trim().length < 8)
        return { data: null, error: { message: "Registro ou motivo inválido" } };
      if (mockDb.delayNextMessageRpc) {
        const delay = mockDb.delayNextMessageRpc;
        mockDb.delayNextMessageRpc = null;
        await delay;
      }
      const status = String(params["_message_status"]);
      row["status"] = status;
      mockDb.updates++;
      mockDb.audits.push({ id: String(row["id"]), status, reason });
      return { data: { ok: true, action: "mark_message" }, error: null };
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
  mockDb.directUpdates = 0;
  mockDb.audits = [];
  mockDb.delayNextMessageQuery = null;
  mockDb.delayNextMessageRpc = null;
  mockDb.failNextMessageRead = false;
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

  it("descarta confirmação de mensagem ao mudar filtro sem executar ação", async () => {
    const id = "a8d48d0f-a011-4a1c-a6a7-3ebd210dc258";
    mockDb.messages = [{ id, name: "Cliente", subject: "Mensagem pendente",
      status: "nova", email: "cliente@example.test", message: "Conteúdo de teste",
      created_at: "2026-11-14T00:00:00Z" }];
    render(<AdminMessageQueue />);
    expect(await screen.findByText("Mensagem pendente")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Marcar respondida/ }));
    expect(screen.getByRole("button", { name: "Confirmar e auditar" })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Situação" }),
      { target: { value: "respondida" } });
    expect(await screen.findByText("Nenhuma mensagem para este filtro.")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Situação" }),
      { target: { value: "todas" } });
    expect(await screen.findByText("Mensagem pendente")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar e auditar" })).toBeNull();
    expect(mockDb.updates).toBe(0);
  });

  it("bloqueia navegação durante RPC e exige atualização explícita após releitura inconclusiva", async () => {
    const id = "a8d48d0f-a011-4a1c-a6a7-3ebd210dc258";
    mockDb.messages = Array.from({ length: 21 }, (_, index) => ({
      id: index === 0 ? id : "msg-" + index, name: "Cliente",
      subject: "Mensagem " + (index + 1), status: "nova",
      email: "cliente@example.test", message: "Conteúdo de teste",
      created_at: "2026-11-14T00:00:00Z",
    }));
    render(<AdminMessageQueue />);
    expect(await screen.findByText("Mensagem 1")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Marcar respondida/ })[0]!);
    fireEvent.change(screen.getByRole("textbox", { name: /Justificativa de auditoria/ }),
      { target: { value: "Conferência administrativa pendente" } });

    let releaseRpc!: () => void;
    mockDb.delayNextMessageRpc = new Promise<void>((resolve) => { releaseRpc = resolve; });
    mockDb.failNextMessageRead = true;
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e auditar" }));
    expect(mockDb.updates).toBe(0);
    expect(screen.getByRole("textbox", { name: "Localizar mensagem" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("combobox", { name: "Situação" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /Atualizar/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /Próxima/ })).toHaveProperty("disabled", true);
    releaseRpc();

    expect(await screen.findByRole("alert")).toHaveProperty("textContent",
      "O servidor confirmou a alteração, mas a releitura falhou. Atualize a lista antes de agir novamente.");
    expect(mockDb.updates).toBe(1);
    expect(mockDb.audits).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Situação" }),
      { target: { value: "respondida" } });
    await waitFor(() => expect(screen.getByText("1 mensagem(ns) · página 1 de 1")).toBeTruthy());
    expect(screen.getByRole("button", { name: /Arquivar/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("alert")).toHaveProperty("textContent",
      "O servidor confirmou a alteração, mas a releitura falhou. Atualize a lista antes de agir novamente.");

    const queriesBeforeSearch = mockDb.ranges.length;
    fireEvent.change(screen.getByRole("textbox", { name: "Localizar mensagem" }),
      { target: { value: "Mensagem 1" } });
    await waitFor(() => expect(mockDb.ranges.length).toBeGreaterThan(queriesBeforeSearch));
    expect(screen.getByRole("alert")).toHaveProperty("textContent",
      "O servidor confirmou a alteração, mas a releitura falhou. Atualize a lista antes de agir novamente.");

    await waitFor(() => expect(screen.getByRole("button", { name: /Atualizar/ }))
      .toHaveProperty("disabled", false));
    fireEvent.click(screen.getByRole("button", { name: /Atualizar/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Arquivar/ }))
      .toHaveProperty("disabled", false));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mockDb.updates).toBe(1);
    expect(mockDb.audits).toHaveLength(1);
  });

  it("não herda desbloqueio de atualização iniciada antes do debounce", async () => {
    const id = "e2c9e3de-1b5c-4b5d-8643-9c7dc5ac39b5";
    mockDb.messages = [{
      id, name: "Cliente", subject: "Mensagem pendente do debounce",
      status: "nova", email: "cliente@example.test", message: "Conteúdo de teste",
      created_at: "2026-11-14T00:00:00Z",
    }];
    render(<AdminMessageQueue />);
    expect(await screen.findByText("Mensagem pendente do debounce")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Marcar respondida/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Justificativa de auditoria/ }),
      { target: { value: "Validação da pesquisa pendente" } });
    mockDb.failNextMessageRead = true;
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e auditar" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent",
      "O servidor confirmou a alteração, mas a releitura falhou. Atualize a lista antes de agir novamente.");
    expect(screen.getByRole("button", { name: /Arquivar/ })).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByRole("textbox", { name: "Localizar mensagem" }),
      { target: { value: "Mensagem pendente" } });
    const refresh = screen.getByRole("button", { name: /Atualizar/ });
    // Clicking before the 280ms debounce must not authorize an automatic query.
    expect(refresh).toHaveProperty("disabled", true);
    fireEvent.click(refresh);
    await waitFor(() => expect(refresh).toHaveProperty("disabled", false));
    expect(screen.getByRole("button", { name: /Arquivar/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("alert")).toHaveProperty("textContent",
      "O servidor confirmou a alteração, mas a releitura falhou. Atualize a lista antes de agir novamente.");

    fireEvent.click(refresh);
    await waitFor(() => expect(screen.getByRole("button", { name: /Arquivar/ }))
      .toHaveProperty("disabled", false));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mockDb.updates).toBe(1);
    expect(mockDb.audits).toHaveLength(1);
  });

  it("só confirma mensagem após RPC auditada e releitura do estado persistido", async () => {
    const id = "a8d48d0f-a011-4a1c-a6a7-3ebd210dc258";
    mockDb.messages = [{ id, name: "Cliente", subject: "Preciso de atendimento",
      status: "nova", email: "cliente@example.test", message: "Mensagem", created_at: "2026-11-14T00:00:00Z" }];
    render(<AdminMessageQueue />);
    expect(await screen.findByText("Preciso de atendimento")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Marcar respondida/ }));
    expect(mockDb.messages[0]?.["status"]).toBe("nova");
    fireEvent.change(screen.getByRole("textbox", { name: /Justificativa de auditoria/ }),
      { target: { value: "Resposta encaminhada pela equipe" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e auditar" }));
    expect(await screen.findByText("Situação persistida e registrada na auditoria administrativa.")).toBeTruthy();
    expect(mockDb.messages[0]?.["status"]).toBe("respondida");
    expect(mockDb.updates).toBe(1);
    expect(mockDb.directUpdates).toBe(0);
    expect(mockDb.audits).toEqual([{ id, status: "respondida", reason: "Resposta encaminhada pela equipe" }]);
  });

  it("impede reenviar a mesma ação auditada após falha na releitura", async () => {
    const id = "a8d48d0f-a011-4a1c-a6a7-3ebd210dc258";
    mockDb.messages = [{ id, name: "Cliente", subject: "Mensagem para auditoria",
      status: "nova", email: "cliente@example.test", message: "Mensagem", created_at: "2026-11-14T00:00:00Z" }];
    render(<AdminMessageQueue />);
    expect(await screen.findByText("Mensagem para auditoria")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Marcar respondida/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Justificativa de auditoria/ }),
      { target: { value: "Ação comprovada em auditoria" } });
    mockDb.failNextMessageRead = true;
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e auditar" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent",
      "O servidor confirmou a alteração, mas a releitura falhou. Atualize a lista antes de agir novamente.");
    expect(mockDb.updates).toBe(1);
    expect(mockDb.audits).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Confirmar e auditar" })).toBeNull();
    // A lista mantém o snapshot anterior até o refresh: ambos os botões ficam bloqueados.
    expect(screen.getByRole("button", { name: /Marcar respondida/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /Arquivar/ })).toHaveProperty("disabled", true);
    expect(mockDb.directUpdates).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: /Atualizar/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Marcar respondida/ })).toBeNull());
    expect(screen.getByRole("button", { name: /Arquivar/ })).toHaveProperty("disabled", false);
    expect(mockDb.updates).toBe(1);
    expect(mockDb.audits).toHaveLength(1);
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
