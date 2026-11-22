// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const range = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      if (table !== "legacy_public_archive") throw new Error("Unexpected table");
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range,
      };
      return query;
    },
  },
}));

import { LegacyPublicArchive } from "./legacy-public-archive";

afterEach(() => { cleanup(); range.mockReset(); });

describe("acervo público: falha de consulta", () => {
  it("encerra carregamento e mostra erro seguro se a requisição rejeitar", async () => {
    range.mockRejectedValueOnce(new Error("Synthetic network failure"));
    render(<LegacyPublicArchive show />);
    expect(await screen.findByText("Não foi possível carregar os técnicos agora.")).toBeTruthy();
    expect(screen.queryByText("Carregando técnicos…")).toBeNull();
    expect(screen.queryByText(/Synthetic network failure/)).toBeNull();
  });
});
