// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { LegacyPublicArchive } from "./legacy-public-archive";

afterEach(() => { cleanup(); rpc.mockReset(); });

describe("acervo público: falha de consulta", () => {
  it("encerra carregamento e mostra erro seguro se a requisição rejeitar", async () => {
    rpc.mockRejectedValueOnce(new Error("Synthetic network failure"));
    render(<LegacyPublicArchive show />);
    expect(await screen.findByText("Não foi possível carregar os técnicos agora.")).toBeTruthy();
    expect(screen.queryByText("Carregando técnicos…")).toBeNull();
    expect(screen.queryByText(/Synthetic network failure/)).toBeNull();
    expect(rpc).toHaveBeenCalledWith("eut_public_legacy_archive_page", { _limit: 24, _offset: 0 });
  });
});
