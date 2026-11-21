// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const fixture = vi.hoisted(() => ({
  enabled: true,
  denyWrite: false,
  readbackMismatch: false,
  reads: 0,
  writes: 0,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params: { secao: string } }) =>
    <a href={`/admin/${params.secao}`}>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    async rpc(name: string, args?: { _enabled: boolean; _expected_enabled: boolean; _reason: string }) {
      if (name === "eut_home_public_proof_visible") {
        fixture.reads++;
        return { data: fixture.readbackMismatch ? !fixture.enabled : fixture.enabled, error: null };
      }
      if (name === "eut_admin_set_home_public_proof" && args) {
        fixture.writes++;
        if (fixture.denyWrite) return { data: null, error: { message: "not authorized" } };
        if (args._expected_enabled !== fixture.enabled) return { data: null, error: { message: "stale" } };
        fixture.enabled = args._enabled;
        return { data: { ok: true, enabled: args._enabled }, error: null };
      }
      throw new Error("RPC inesperada: " + name);
    },
  },
}));

import { AdminFeatureSettings } from "./admin-feature-settings";

afterEach(() => {
  cleanup();
  fixture.enabled = true;
  fixture.denyWrite = false;
  fixture.readbackMismatch = false;
  fixture.reads = 0;
  fixture.writes = 0;
});

describe("Central de Configurações: uma flag auditada", () => {
  it("exige justificativa, grava e relê o estado antes de confirmar sucesso", async () => {
    render(<AdminFeatureSettings />);
    await waitFor(() => expect(screen.getByText("Habilitado")).toBeTruthy());
    const button = screen.getByRole("button", { name: /desabilitar seção/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Justificativa da alteração/i), {
      target: { value: "Pausar perfis na Home temporariamente" },
    });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText("Desabilitado")).toBeTruthy());
    expect(screen.getByText(/desabilitada e confirmada no servidor/i)).toBeTruthy();
    expect(fixture.writes).toBe(1);
    expect(fixture.reads).toBe(2);
  });

  it("não anuncia salvamento quando o backend rejeita", async () => {
    fixture.denyWrite = true;
    render(<AdminFeatureSettings />);
    await waitFor(() => expect(screen.getByText("Habilitado")).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Justificativa da alteração/i), {
      target: { value: "Tentativa legítima sem permissão efetiva" },
    });
    fireEvent.click(screen.getByRole("button", { name: /desabilitar seção/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByText(/confirmada no servidor/i)).toBeNull();
    expect(screen.getByText("Habilitado")).toBeTruthy();
  });
});
