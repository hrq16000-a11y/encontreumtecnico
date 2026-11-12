// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, search, children }: { to: string; search?: { wp?: number }; children: ReactNode }) => (
    <a href={to + (search?.wp ? "?wp=" + encodeURIComponent(JSON.stringify(search.wp)) : "")}>{children}</a>
  ),
}));
vi.mock("@/components/page-placeholder", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { HistoricalWordPressProfile } from "./historical-wordpress-profile";
import { normalizeWpPostId } from "@/lib/legacy-claim-validation";

const candidate = {
  kind: "candidate" as const,
  slug: "perfil-historico",
  wp_post_id: 4415,
  display_name: "Profissional histórico",
  status: "em_validacao" as const,
};

afterEach(cleanup);

describe("recuperação iniciada por página histórica", () => {
  it("carrega o ID público exato no formulário de reivindicação", () => {
    render(<HistoricalWordPressProfile kind="candidate" reference={candidate} />);
    const link = screen.getByRole("link", { name: /Solicite a associação com sua nova conta/i });
    expect(link.getAttribute("href")).toBe("/reivindicar-cadastro?wp=4415");
    const actualId = new URL(link.getAttribute("href")!, "https://example.test").searchParams.get("wp");
    expect(normalizeWpPostId(actualId ?? "")).toBe(4415);
    expect(screen.getByText(/O contato não está habilitado/)).toBeTruthy();
    expect(screen.getByText(/Pioneiro Bronze · pré-cadastro, não ativado/)).toBeTruthy();
  });

  it("não oferece reivindicação de profissional no perfil antigo do cliente", () => {
    render(<HistoricalWordPressProfile kind="employer" reference={{ ...candidate, kind: "employer" }} />);
    expect(screen.queryByRole("link", { name: /Solicite a associação/ })).toBeNull();
  });

  it("não cria link de reivindicação para slug histórico inexistente", () => {
    render(<HistoricalWordPressProfile kind="candidate" reference={null} />);
    expect(screen.queryByRole("link", { name: /Solicite a associação/ })).toBeNull();
  });
});
