import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { LegacyReviewQueue } from "./legacy-review-queue";

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) =>
    <a href="/admin/tecnicos" className={className}>{children}</a>,
}));

const profiles = [
  {
    source_key: "wordpress_20261108", wp_post_id: 207, wp_user_id: 22,
    kind: "candidate", slug: "wanda-historica", title: "Wanda Histórica", specialty_title: "Suporte",
    location1: "Local de teste", location2: null, location3: null,
    review_status: "excluded", demo_candidate: true,
  },
  {
    source_key: "wordpress_20261108", wp_post_id: 301, wp_user_id: 41,
    kind: "candidate", slug: "tecnico-sintetico", title: "Técnico Sintético", specialty_title: "Redes",
    location1: "Local de teste", location2: null, location3: null,
    review_status: "pending_review", demo_candidate: false,
  },
];

beforeEach(() => {
  from.mockImplementation((table: string) => {
    const query: Record<string, (...args: unknown[]) => unknown> = {};
    query["select"] = () => query;
    query["eq"] = () => query;
    query["ilike"] = () => query;
    query["order"] = () => query;
    query["range"] = async () => ({ data: profiles, count: profiles.length, error: null });
    query["in"] = async () => ({
      data: [{ wp_post_id: 207, record_state: "excluido", corrected_name: null, admin_notes: null }],
      error: null,
    });
    if (!["legacy_review_profiles", "eut_legacy_profile_management"].includes(table)) {
      throw new Error("Unexpected synthetic table: " + table);
    }
    return query;
  });
});

afterEach(() => { cleanup(); from.mockReset(); rpc.mockReset(); });

describe("gestão visual do acervo histórico", () => {
  it("abre detalhes sem contato privado e explica por que uma demonstração arquivada não pode ser editada", async () => {
    render(<LegacyReviewQueue />);
    const open = await screen.findByRole("button", { name: "Ver ficha · Wanda Histórica" });
    fireEvent.click(open);
    const details = document.getElementById("legacy-details-candidate-207");
    expect(details?.textContent).toContain("wanda-historica");
    expect(details?.textContent).toContain("Não há edição, restauração ou exclusão permanente disponível");
    expect(details?.querySelector("a[href^='tel:'], a[href^='mailto:'], a[href*='wa.me']")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Selecionar cadastro WordPress 207" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByRole("button", { name: "Editar nome" })[0]?.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar ficha · Wanda Histórica" }));
    expect(document.getElementById("legacy-details-candidate-207")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("seleciona somente fichas gerenciáveis e habilita apenas ações válidas", async () => {
    render(<LegacyReviewQueue />);
    await screen.findByRole("button", { name: "Ver ficha · Técnico Sintético" });
    fireEvent.click(screen.getByRole("button", { name: "Selecionar página" }));
    expect(screen.getByText("1 selecionada(s)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revisar lote" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Arquivar lote" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Restaurar lote" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Revisar lote" }));
    await waitFor(() => expect(screen.getByRole("form", { name: "Confirmar gestão histórica" })).toBeTruthy());
    expect(rpc).not.toHaveBeenCalled();
  });
});
