import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AdminContactsDashboard } from "./admin-contacts-dashboard";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#admin">{children}</a>,
}));

const technician = {
  id: "tec-1", user_id: "owner-1", display_name: "Técnico Exemplo",
  status: "aprovado", city: "Curitiba", state_uf: "PR", created_at: "2026-11-20",
  email: null, phone: null, has_phone: false, allow_paid_contact: false,
  blocked_account: false, blocked_phone: false,
};
const firstPage = {
  rows: [technician], blocked: [], audit: [], messages: [], stats: {},
  total: 1, page: 0,
};

beforeEach(() => rpc.mockReset());
afterEach(() => cleanup());

describe("Contatos administrativos: proteção durante troca de consulta", () => {
  it("oculta a lista antiga e cancela a operação pendente ao buscar novamente", async () => {
    let completeNext!: (result: unknown) => void;
    rpc.mockResolvedValueOnce({ data: firstPage, error: null })
      .mockImplementationOnce(() => new Promise((resolve) => { completeNext = resolve; }));
    render(<AdminContactsDashboard adminId="admin-a" />);
    expect(await screen.findByText("Técnico Exemplo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Banir conta" }));
    expect(screen.getByRole("form", { name: "Confirmar operação administrativa auditada" }))
      .toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nome, cidade, e-mail ou telefone"), {
      target: { value: "Outro técnico" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Técnico Exemplo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Banir conta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Confirmar operação administrativa auditada" }))
      .not.toBeInTheDocument();

    completeNext({ data: { ...firstPage, rows: [], total: 0 }, error: null });
    expect(rpc).toHaveBeenCalledWith("eut_admin_contacts_dashboard", {
      _search: "Outro técnico", _filter: "todos", _page: 0,
    });
  });
});
