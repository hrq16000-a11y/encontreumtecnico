import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { TechnicianPrivateContact } from "./technician-private-contact";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) =>
    <a href={to} className={className}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  rpc.mockReset();
});

const emptyContact = { has_number: false, phone: null, allow_paid_contact: false };

describe("suporte em falhas no telefone privado", () => {
  it("mostra a central de ajuda quando a consulta privada é recusada sem revelar detalhes", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "restricted private account" } });
    render(<TechnicianPrivateContact userId="synthetic-tech-a" />);
    const link = await screen.findByRole("link", { name: "Solicitar ajuda" });
    expect(link.getAttribute("href")).toBe("/ajuda-acesso");
    expect(screen.getByRole("status").textContent).toContain("Não foi possível consultar");
    expect(screen.queryByText("restricted private account")).toBeNull();
  });

  it("orienta suporte se o salvamento falha, sem expor telefone na URL", async () => {
    rpc.mockResolvedValueOnce({ data: emptyContact, error: null })
      .mockResolvedValueOnce({ data: { saved: false }, error: { message: "restricted private account" } });
    render(<TechnicianPrivateContact userId="synthetic-tech-b" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar telefone privado" }).hasAttribute("disabled")).toBe(false));
    fireEvent.change(screen.getByRole("textbox", { name: /Telefone com DDD/ }), { target: { value: "(41) 99999-8888" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar telefone privado" }));
    const link = await screen.findByRole("link", { name: "Solicitar ajuda" });
    expect(link.getAttribute("href")).toBe("/ajuda-acesso");
    expect(link.getAttribute("href")).not.toContain("99999");
    expect(screen.queryByText("restricted private account")).toBeNull();
  });

  it("não confunde cadastro salvo com falha nem mostra o link em sucesso", async () => {
    rpc.mockResolvedValueOnce({ data: emptyContact, error: null })
      .mockResolvedValueOnce({ data: { saved: true }, error: null });
    render(<TechnicianPrivateContact userId="synthetic-tech-c" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar telefone privado" }).hasAttribute("disabled")).toBe(false));
    fireEvent.change(screen.getByRole("textbox", { name: /Telefone com DDD/ }), { target: { value: "(41) 99999-8888" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar telefone privado" }));
    await screen.findByText(/Telefone salvo como privado/);
    expect(screen.queryByRole("link", { name: "Solicitar ajuda" })).toBeNull();
  });
});
