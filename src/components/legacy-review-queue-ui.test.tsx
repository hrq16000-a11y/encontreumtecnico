import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { LegacyReviewQueue } from "./legacy-review-queue";

const { from, rpc, eqSpy } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), eqSpy: vi.fn() }));
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
    review_status: "excluded", demo_candidate: true, private_phone: "550000000099",
  },
  {
    source_key: "wordpress_20261108", wp_post_id: 301, wp_user_id: 41,
    kind: "candidate", slug: "tecnico-sintetico", title: "Técnico Sintético", specialty_title: "Redes",
    location1: "Local de teste", location2: null, location3: null,
    review_status: "pending_review", demo_candidate: false,
  },
];

beforeEach(() => {
  window.history.replaceState(null, "", "/admin/legado");
  eqSpy.mockReset();
  from.mockImplementation((table: string) => {
    const query: Record<string, (...args: unknown[]) => unknown> = {};
    let selectedId: number | null = null;
    query["select"] = () => query;
    query["eq"] = (key: unknown, value: unknown) => {
      eqSpy(key, value);
      if (key === "wp_post_id") selectedId = Number(value);
      return query;
    };
    query["ilike"] = () => query;
    query["order"] = () => query;
    query["range"] = async () => {
      const matching = selectedId === null ? profiles : profiles.filter((row) => row.wp_post_id === selectedId);
      return { data: matching, count: matching.length, error: null };
    };
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
  it("permite consultar técnicos importados dentro da gestão de técnicos, sem misturar contratantes", async () => {
    render(<LegacyReviewQueue onlyTechnicians />);
    expect(await screen.findByRole("heading", { name: "Técnicos antigos — gestão auditada" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Contratantes" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Ver ficha · Técnico Sintético" })).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("abre detalhes sem contato privado e explica por que uma demonstração arquivada não pode ser editada", async () => {
    render(<LegacyReviewQueue />);
    const open = await screen.findByRole("button", { name: "Ver ficha · Wanda Histórica" });
    const controls = open.getAttribute("aria-controls");
    expect(controls).toBe("legacy-details-candidate-207");
    expect(document.getElementById(controls!)?.hidden).toBe(true);
    open.focus();
    fireEvent.click(open);
    const details = document.getElementById("legacy-details-candidate-207");
    expect(open.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(open);
    expect(details?.hidden).toBe(false);
    expect(details?.textContent).toContain("wanda-historica");
    expect(details?.textContent).toContain("Não há edição, restauração ou exclusão permanente disponível");
    expect(details?.querySelector("a[href^='tel:'], a[href^='mailto:'], a[href*='wa.me']")).toBeNull();
    expect(document.body.textContent).not.toContain("550000000099");
    expect(screen.getByRole("checkbox", { name: "Selecionar cadastro WordPress 207" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByRole("button", { name: "Editar nome" })[0]?.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar ficha · Wanda Histórica" }));
    expect(open.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(open);
    expect(document.getElementById("legacy-details-candidate-207")?.hidden).toBe(true);
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
  it("abre a ficha WordPress pelo ID original, preservando edição auditada", async () => {
    window.history.replaceState(null, "", "/admin/legado?registro=wp:candidate:301");
    render(<LegacyReviewQueue />);
    const selected = await screen.findByRole("button", { name: "Ocultar ficha · Técnico Sintético" });
    expect(eqSpy).toHaveBeenCalledWith("wp_post_id", 301);
    expect(eqSpy).toHaveBeenCalledWith("kind", "candidate");
    expect(selected.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("button", { name: "Ver ficha · Wanda Histórica" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Editar nome" }));
    expect(screen.getByRole("form", { name: "Confirmar gestão histórica" })).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todos os cadastros" }));
    await screen.findByRole("button", { name: "Ver ficha · Wanda Histórica" });
    expect(window.location.search).not.toContain("registro=");
  });

  it("rejeita registro URL inválido, sem selecionar outra ficha por nome", async () => {
    window.history.replaceState(null, "", "/admin/legado?registro=wp:candidate:301-errado");
    render(<LegacyReviewQueue />);
    expect(await screen.findByRole("button", { name: "Ver ficha · Wanda Histórica" })).toBeTruthy();
    expect(eqSpy).not.toHaveBeenCalledWith("wp_post_id", expect.anything());
    expect(screen.queryByRole("button", { name: "Mostrar todos os cadastros" })).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

});
