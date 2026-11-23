// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockDb = vi.hoisted(() => ({
  requests: [] as Array<Record<string, unknown>>,
  ranges: [] as Array<[number, number]>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      if (table !== "service_requests") throw new Error("Unexpected admin table: " + table);
      let focusedId: string | null = null;
      const builder = {
        select: () => builder,
        eq(field: string, value: string) {
          if (field === "id") focusedId = value;
          return builder;
        },
        or: () => builder,
        order: () => builder,
        async range(start: number, end: number) {
          mockDb.ranges.push([start, end]);
          const rows = mockDb.requests.filter((row) => !focusedId || row["id"] === focusedId);
          return { data: rows.slice(start, end + 1).map((row) => ({ ...row })), count: rows.length, error: null };
        },
      };
      return builder;
    },
  },
}));

import { AdminRequestQueue } from "./admin-request-queue";

function requests(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `mock-request-${index + 1}`,
    title: `Pedido ${index + 1}`,
    category: "Informática",
    city: "Curitiba",
    region: null,
    status: "aberta",
    description: "Exemplo sintético sem contato",
    created_at: "2026-11-22T12:00:00Z",
  }));
}

beforeEach(() => {
  window.history.replaceState({}, "", "/admin/solicitacoes");
  mockDb.requests = [];
  mockDb.ranges = [];
});
afterEach(cleanup);

describe("fila de solicitações: atualização após redução do total", () => {
  it("volta à primeira página quando a segunda deixa de existir, sem indicar lista vazia", async () => {
    mockDb.requests = requests(25);
    render(<AdminRequestQueue />);

    expect(await screen.findByText("Pedido 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Próxima/ }));
    expect(await screen.findByText("Pedido 21")).toBeTruthy();

    mockDb.requests = requests(5);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => expect(screen.getByText("Página 1 de 1")).toBeTruthy());
    expect(await screen.findByText("Pedido 1")).toBeTruthy();
    expect(screen.queryByText("Nenhum pedido corresponde aos filtros.")).toBeNull();
    expect((screen.getByRole("button", { name: /Próxima/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(mockDb.ranges.some(([start, end]) => start === 20 && end === 39)).toBe(true);
    expect(mockDb.ranges.at(-1)).toEqual([0, 19]);
  });

  it("retrocede somente até a última página válida quando existem pedidos restantes", async () => {
    mockDb.requests = requests(45);
    render(<AdminRequestQueue />);
    expect(await screen.findByText("Pedido 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Próxima/ }));
    expect(await screen.findByText("Pedido 21")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Próxima/ }));
    expect(await screen.findByText("Pedido 41")).toBeTruthy();

    mockDb.requests = requests(25);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => expect(screen.getByText("Página 2 de 2")).toBeTruthy());
    expect(await screen.findByText("Pedido 21")).toBeTruthy();
    expect(screen.queryByText("Pedido 1")).toBeNull();
    expect(mockDb.ranges.at(-1)).toEqual([20, 39]);
  });
});
