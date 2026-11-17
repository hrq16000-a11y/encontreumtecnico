// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const fixture = vi.hoisted(() => ({ approved: 7 as number | null, approvedError: false }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: React.ReactNode; params: { secao: string } }) => (
    <a href={`/admin/${params.secao}`}>{children}</a>
  ),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      return {
        select() {
          const response = (value: number | null, error = false) => ({
            count: value,
            error: error ? { message: "unavailable" } : null,
          });
          return {
            eq(_column: string, value: string) {
              if (table === "technicians" && value === "aprovado")
                return Promise.resolve(response(fixture.approved, fixture.approvedError));
              return Promise.resolve(response(0));
            },
            then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
              return Promise.resolve(response(0)).then(resolve, reject);
            },
          };
        },
      };
    },
    async rpc(name: string) {
      if (name === "eut_admin_client_insights")
        return { data: { clients_total: 0, clients_unconfirmed: 0 }, error: null };
      if (name === "eut_ads_admin_snapshot")
        return {
          data: { totals: { sponsors: 0, campaigns: 0 }, sponsors: [], campaigns: [] },
          error: null,
        };
      throw new Error(`Unexpected RPC: ${name}`);
    },
  },
}));

import { AdminCommandOverview } from "./admin-command-overview";

afterEach(() => {
  cleanup();
  fixture.approved = 7;
  fixture.approvedError = false;
});

describe("indicador administrativo de técnicos", () => {
  it("mostra o total aprovado do portal com escopo explícito", async () => {
    render(<AdminCommandOverview />);
    const card = screen.getByRole("link", { name: /Técnicos aprovados no portal/ });
    await waitFor(() => expect(card.textContent).toContain("7"));
    expect(card.textContent).toContain("Não inclui fichas históricas ou cadastros administrativos");
    expect(card.getAttribute("href")).toBe("/admin/tecnicos");
  });

  it("preserva zero legítimo e não exibe indisponibilidade como zero", async () => {
    fixture.approved = 0;
    const view = render(<AdminCommandOverview />);
    let card = screen.getByRole("link", { name: /Técnicos aprovados no portal/ });
    await waitFor(() => expect(card.textContent).toContain("0"));
    expect(card.textContent).not.toContain("Indisponível");

    view.unmount();
    fixture.approvedError = true;
    render(<AdminCommandOverview />);
    card = screen.getByRole("link", { name: /Técnicos aprovados no portal/ });
    await waitFor(() => expect(card.textContent).toContain("Indisponível"));
    expect(screen.getByText(/Alguns indicadores estão indisponíveis/)).toBeTruthy();
  });
});
