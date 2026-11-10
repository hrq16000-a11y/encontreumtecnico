import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LegacyAccountActivation } from "./legacy-account-activation";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

afterEach(() => {
  cleanup();
  rpc.mockReset();
});

describe("WordPress account recovery lookup", () => {
  it("explains lookup errors and allows retry without implying the account is missing", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "temporarily unavailable" } })
      .mockResolvedValueOnce({ data: [], error: null });

    render(<LegacyAccountActivation userId="user-1" role="tecnico" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("não significa que ele foi perdido");
    expect(alert.textContent).toContain("Nenhuma associação foi feita");
    fireEvent.click(screen.getByRole("button", { name: "Tentar consultar novamente" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(rpc).toHaveBeenNthCalledWith(2, "eut_my_legacy_account");
  });

  it("also surfaces transport failures rather than silently hiding recovery", async () => {
    rpc.mockRejectedValueOnce(new Error("network lost"));

    render(<LegacyAccountActivation userId="user-2" role="cliente" />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar consultar novamente" })).toBeTruthy();
  });

  it("does not show an error for a successful lookup with no linked record", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });

    render(<LegacyAccountActivation userId="user-3" role="tecnico" />);

    await waitFor(() => expect(rpc).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.queryByRole("button", { name: "Tentar consultar novamente" })).toBeNull();
  });
});
