import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_OPERATIONS } from "@/lib/technician-operations-contract";
import { TechnicianOperationsEditor } from "./technician-operations-editor";

const api = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: api.rpc, from: api.from },
}));

const stored = { ...EMPTY_OPERATIONS, transport_mode: "car" as const, km_rate_cents: 250 };

beforeEach(() => {
  api.rpc.mockReset();
  api.from.mockReset();
  api.rpc.mockImplementation(async (name: string) => {
    if (name !== "eut_technician_operations_get") throw new Error("Unexpected write");
    return { data: { ok: true, profile: stored, updated_at: "2026-11-20T00:00:00Z" }, error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("editor de condições: descartar somente alterações locais", () => {
  it("restaura transporte e tarifa previamente relidos, sem chamar a RPC de gravação", async () => {
    render(<TechnicianOperationsEditor technicianId="tecnico-a" coverageCityIds={[]} mode="technician" />);
    const transport = await screen.findByLabelText("Meio de locomoção declarado") as HTMLSelectElement;
    const rate = screen.getByLabelText("R$/km até o limite informado") as HTMLInputElement;
    const discard = screen.getByRole("button", { name: "Descartar alterações" });
    expect(transport.value).toBe("car");
    expect(rate.value).toBe("2,50");
    expect(discard.hasAttribute("disabled")).toBe(true);

    fireEvent.change(transport, { target: { value: "motorcycle" } });
    fireEvent.change(rate, { target: { value: "4,00" } });
    expect(discard.hasAttribute("disabled")).toBe(false);

    fireEvent.click(discard);
    expect(transport.value).toBe("car");
    expect(rate.value).toBe("2,50");
    expect(discard.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Alterações locais descartadas. Nenhum dado foi gravado.")).toBeTruthy();
    expect(api.rpc).toHaveBeenCalledTimes(1);
    expect(api.rpc).toHaveBeenCalledWith("eut_technician_operations_get", { _technician_id: "tecnico-a" });
  });

  it("limpa somente o motivo administrativo local e mantém o registro carregado", async () => {
    render(<TechnicianOperationsEditor technicianId="tecnico-a" coverageCityIds={[]} mode="admin" />);
    const reason = await screen.findByLabelText("Motivo administrativo da edição (obrigatório)") as HTMLTextAreaElement;
    const discard = screen.getByRole("button", { name: "Descartar alterações" });
    fireEvent.change(reason, { target: { value: "Revisão da ficha de teste" } });
    expect(discard.hasAttribute("disabled")).toBe(false);
    fireEvent.click(discard);
    expect(reason.value).toBe("");
    expect(api.rpc).toHaveBeenCalledTimes(1);
  });
});
