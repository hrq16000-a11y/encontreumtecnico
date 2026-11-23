// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { AdminMemberInvites } from "./admin-member-invites";

const pendingInvite = {
  id: "qa-invite-1",
  target_role: "cliente",
  masked_email: "q***@example.invalid",
  status: "pending",
  created_at: "2026-11-22T12:00:00Z",
  expires_at: "2026-11-25T12:00:00Z",
};

beforeEach(() => rpc.mockReset());
afterEach(cleanup);

describe("convites administrativos: erro, vazio e recuperação", () => {
  it("não chama uma falha de leitura de 'nenhum convite' e recupera no Atualizar", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "private diagnostic" } });
    rpc.mockResolvedValueOnce({ data: { invites: [pendingInvite] }, error: null });

    render(<AdminMemberInvites initialRole="cliente" />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível carregar os convites");
    expect(alert.textContent).not.toContain("private diagnostic");
    expect(screen.queryByText("Nenhum convite nesta consulta.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Revogar" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByText("q***@example.invalid")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Revogar" })).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "eut_admin_member_invites_snapshot");
    expect(rpc).toHaveBeenNthCalledWith(2, "eut_admin_member_invites_snapshot");
  });

  it("trata resposta malformada como erro e só mostra vazio após retorno confirmado", async () => {
    rpc.mockResolvedValueOnce({ data: { invites: null }, error: null });
    rpc.mockResolvedValueOnce({ data: { invites: [] }, error: null });

    render(<AdminMemberInvites />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent",
      "Não foi possível carregar os convites. Verifique seu acesso administrativo.");
    expect(screen.queryByText("Nenhum convite nesta consulta.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByText("Nenhum convite nesta consulta.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("não deixa convite antigo disponível enquanto a atualização carrega ou falha", async () => {
    let rejectRefresh: ((reason: Error) => void) | undefined;
    rpc.mockResolvedValueOnce({ data: { invites: [pendingInvite] }, error: null });
    rpc.mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectRefresh = reject;
    }));

    render(<AdminMemberInvites />);
    expect(await screen.findByRole("button", { name: "Revogar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(screen.getByText("Consultando convites…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Revogar" })).toBeNull();

    rejectRefresh?.(new Error("network down"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Erro de conexão"));
    expect(screen.queryByText("Nenhum convite nesta consulta.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Revogar" })).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
