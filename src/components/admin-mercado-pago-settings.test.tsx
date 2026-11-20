import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminMercadoPagoSettings } from "./admin-mercado-pago-settings";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const current = {
  enabled: false, regular_price_cents: 999, outside_price_cents: 2999,
  regular_from: "09:00", regular_until: "18:00", daily_contact_limit: 2,
  version: 1, updated_at: null,
};
afterEach(() => { cleanup(); rpc.mockReset(); });

describe("Central Financeira do proprietário", () => {
  it("falha fechado se a RPC ainda não está instalada ou autorizada", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    render(<AdminMercadoPagoSettings />);
    expect(await screen.findByRole("alert")).toHaveTextContent("não estão disponíveis");
    expect(screen.queryByText("Salvar e confirmar")).toBeNull();
  });
  it("persiste dados com versão e justificativa e só confirma após releitura", async () => {
    rpc.mockResolvedValueOnce({ data: current, error: null })
      .mockResolvedValueOnce({ data: { ok: true, version: 2 }, error: null })
      .mockResolvedValueOnce({ data: { ...current, enabled: true, regular_price_cents: 1199,
        version: 2 }, error: null });
    render(<AdminMercadoPagoSettings />);
    const price = await screen.findByLabelText("Preço no horário comercial (R$)");
    fireEvent.change(price, { target: { value: "11,99" } });
    fireEvent.click(screen.getByLabelText("Habilitar comercialmente o checkout"));
    fireEvent.change(screen.getByLabelText("Justificativa para auditoria"),
      { target: { value: "Revisão do preço e liberação comercial de teste" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar e confirmar" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Alteração gravada"));
    expect(rpc).toHaveBeenNthCalledWith(2, "eut_admin_mp_update_settings", expect.objectContaining({
      _enabled: true, _regular_price_cents: 1199, _outside_price_cents: 2999,
      _expected_version: 1, _reason: "Revisão do preço e liberação comercial de teste",
    }));
    expect(rpc).toHaveBeenNthCalledWith(3, "eut_admin_mp_settings");
  });
  it("não mostra sucesso se o servidor relê outra versão ou valor", async () => {
    rpc.mockResolvedValueOnce({ data: current, error: null })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: current, error: null });
    render(<AdminMercadoPagoSettings />);
    await screen.findByLabelText("Preço fora do horário (R$)");
    fireEvent.change(screen.getByLabelText("Justificativa para auditoria"),
      { target: { value: "Revisão operacional dos preços de contato" } });
    fireEvent.change(screen.getByLabelText("Preço fora do horário (R$)"),
      { target: { value: "39,99" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar e confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("não pôde ser confirmada");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
