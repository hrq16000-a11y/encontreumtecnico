// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/lib/guiafix-staging-normalizer", () => ({
  readGuiafixStaging: () => [],
  normalizeGuiafixSearch: (value: string) => value.toLowerCase(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      let term = "";
      const query = {
        select: () => query,
        ilike(_field: string, value: string) { term = value.slice(1, -1); return query; },
        eq: () => query,
        neq: () => query,
        order: () => query,
        limit() {
          const row = term === "zzqalpha"
            ? { id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", display_name: "Alfafixo único", city: "Curitiba", state_uf: "PR" }
            : term === "zzqbeta"
              ? { id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb", display_name: "Betafixo único", city: "Curitiba", state_uf: "PR" }
              : null;
          return Promise.resolve({ data: table === "technicians" && row ? [row] : [], error: null });
        },
      };
      return query;
    },
    rpc(name: string) {
      return Promise.resolve({
        data: name === "eut_admin_accounts_snapshot" ? { accounts: [] }
          : name === "eut_ads_admin_snapshot"
            ? { sponsors: [], campaigns: [], creatives: [], placements: [] } : [],
        error: null,
      });
    },
  },
}));

import { AdminGlobalSearch } from "./admin-global-search";

afterEach(cleanup);

describe("busca global administrativa — resultados associados ao termo", () => {
  it("não mantém um link antigo clicável durante uma nova consulta", async () => {
    render(<AdminGlobalSearch />);
    fireEvent.click(screen.getByRole("button", { name: /Localizar no painel/ }));
    const input = screen.getByRole("textbox", { name: "Buscar na administração" });

    fireEvent.change(input, { target: { value: "zzqalpha" } });
    expect(await screen.findByText("Alfafixo único", {}, { timeout: 3000 })).toBeTruthy();

    fireEvent.change(input, { target: { value: "zzqbeta" } });
    expect(screen.queryByText("Alfafixo único")).toBeNull();
    expect(await screen.findByText("Betafixo único", {}, { timeout: 3000 })).toBeTruthy();
  });
});
