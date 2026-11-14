// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockRead = vi.hoisted(() => ({
  failed: false,
  reads: [] as Array<{ fields: string; cutoff: string; kind: string }>,
  events: [
    { category: "Informática", city: "Curitiba", region: "Centro", result_count: 4, created_at: "2026-11-14T12:00:00Z" },
    { category: "CFTV", city: "Pinhais", region: "", result_count: 2, created_at: "2026-11-14T11:35:00Z" },
  ],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel() {
      return {
        on() { return this; },
        subscribe(callback: (status: string) => void) { callback("SUBSCRIBED"); return this; },
        presenceState() { return { visitor: [{ kind: "consented-visitor-tab" }] }; },
      };
    },
    removeChannel() { return Promise.resolve(); },
    from(table: string) {
      if (table !== "search_events") throw new Error("unexpected table");
      return {
        select(fields: string, options?: { head?: boolean }) {
          const query = {
            gte(_field: string, cutoff: string) {
              mockRead.reads.push({ fields, cutoff, kind: options?.head ? "count" : "list" });
              if (options?.head) return Promise.resolve(mockRead.failed
                ? { count: null, error: { message: "not authorized" } }
                : { count: cutoff.includes("11:55") ? 1 : 2, error: null });
              return {
                order() {
                  return {
                    limit() {
                      return Promise.resolve(mockRead.failed
                        ? { data: null, error: { message: "not authorized" } }
                        : { data: mockRead.events, error: null });
                    },
                  };
                },
              };
            },
          };
          return query;
        },
      };
    },
  },
}));

import { AdminVisitorActivity, readRecentSearchActivity } from "./admin-visitor-activity";

beforeEach(() => {
  mockRead.reads = [];
  mockRead.failed = false;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("atividade de busca consentida no painel", () => {
  it("usa somente contagens e metadados com RLS, sem consultar identidade ou IP", async () => {
    const result = await readRecentSearchActivity(new Date("2026-11-14T12:00:00Z"));
    expect(result.fiveMinutes).toBe(1);
    expect(result.thirtyMinutes).toBe(2);
    expect(result.recent).toHaveLength(2);
    expect(mockRead.reads).toHaveLength(3);
    expect(mockRead.reads.map((read) => read.fields)).toEqual([
      "id", "id", "category,city,region,result_count,created_at",
    ]);
    expect(mockRead.reads.map((read) => read.cutoff)).toEqual([
      "2026-11-14T11:55:00.000Z", "2026-11-14T11:30:00.000Z", "2026-11-14T11:30:00.000Z",
    ]);
  });

  it("permite filtrar atividade real por período e cidade, sem chamar usuários de online", async () => {
    render(<AdminVisitorActivity />);
    await screen.findByText("Informática");
    expect(screen.getByText("CFTV")).toBeTruthy();
    expect(screen.getByText(/Não representam visitantes únicos ou pessoas online/)).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Período" }), { target: { value: "5" } });
    expect(screen.queryByText("CFTV")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: /Filtrar por serviço ou localidade/ }), { target: { value: "Pinhais" } });
    expect(screen.queryByText("Informática")).toBeNull();
    expect(screen.getByText(/Nenhuma busca consentida corresponde/)).toBeTruthy();
  });

  it("mostra indisponível em erro de consulta e nunca converte falha em zero", async () => {
    mockRead.failed = true;
    render(<AdminVisitorActivity />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("indisponível"));
    expect(screen.queryByText("0", { exact: true })).toBeNull();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
