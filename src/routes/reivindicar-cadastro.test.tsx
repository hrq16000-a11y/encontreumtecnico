// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

type TestUser = { id: string; identities: { provider: string }[]; app_metadata: { provider: string } };
const mock = vi.hoisted(() => ({
  auth: {
    user: null as { id: string; identities: { provider: string }[]; app_metadata: { provider: string } } | null,
    roles: ["tecnico"],
    loading: false,
  },
  rpc: vi.fn(),
  selectClaims: vi.fn(),
  insertClaim: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/page-placeholder", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mock.auth,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mock.rpc,
    from: (table: string) => {
      if (table !== "legacy_profile_claims") throw new Error("Unexpected table");
      return {
        select: () => ({ eq: () => ({ order: () => ({ limit: () => mock.selectClaims() }) }) }),
        insert: (record: unknown) => mock.insertClaim(record),
      };
    },
  },
}));

import { LegacyClaimPage } from "./reivindicar-cadastro";

const user = (id: string): TestUser => ({
  id, identities: [{ provider: "google" }], app_metadata: { provider: "google" },
});
const response = (id: string, wpId: number) => ({
  data: [{ id, wp_post_id: wpId, status: "pendente", created_at: "2026-11-10T00:00:00Z" }],
  error: null,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fn) => { resolve = fn; });
  return { promise, resolve };
}

describe("reivindicação WordPress não atravessa sessões de usuário", () => {
  beforeEach(() => {
    mock.auth.user = user("conta-a");
    mock.auth.roles = ["tecnico"];
    mock.auth.loading = false;
    mock.rpc.mockReset().mockResolvedValue({ data: [], error: null });
    mock.selectClaims.mockReset();
    mock.insertClaim.mockReset().mockResolvedValue({ error: null });
    window.history.replaceState(null, "", "/reivindicar-cadastro");
  });

  it("oculta histórico e limpa formulário ao entrar na conta B", async () => {
    mock.selectClaims.mockImplementation(() => Promise.resolve(
      mock.auth.user?.id === "conta-a" ? response("solicitacao-a", 4415) : response("solicitacao-b", 5516),
    ));
    const view = render(<LegacyClaimPage />);
    expect(await screen.findByText("WordPress #4415")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Observações para a equipe/), {
      target: { value: "Nota particular da conta A" },
    });

    mock.auth.user = user("conta-b");
    view.rerender(<LegacyClaimPage />);
    expect(screen.queryByText("WordPress #4415")).toBeNull();
    expect(screen.queryByDisplayValue("Nota particular da conta A")).toBeNull();
    expect(await screen.findByText("WordPress #5516")).toBeTruthy();
  });

  it("ignora consulta atrasada de A depois que B carregou", async () => {
    const pendingA = deferred<ReturnType<typeof response>>();
    mock.selectClaims.mockImplementationOnce(() => pendingA.promise)
      .mockImplementationOnce(() => Promise.resolve(response("solicitacao-b", 5516)));
    const view = render(<LegacyClaimPage />);
    mock.auth.user = user("conta-b");
    view.rerender(<LegacyClaimPage />);
    expect(await screen.findByText("WordPress #5516")).toBeTruthy();
    await act(async () => pendingA.resolve(response("solicitacao-a", 4415)));
    await waitFor(() => expect(screen.queryByText("WordPress #4415")).toBeNull());
  });

  it("não apresenta confirmação de envio iniciada na conta A após logout/troca", async () => {
    mock.selectClaims.mockResolvedValue({ data: [], error: null });
    const pendingInsert = deferred<{ error: null }>();
    mock.insertClaim.mockImplementationOnce(() => pendingInsert.promise);
    const view = render(<LegacyClaimPage />);
    fireEvent.change(screen.getByLabelText(/ID numérico do cadastro/), { target: { value: "4415" } });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar análise do meu cadastro" }));
    expect(mock.insertClaim).toHaveBeenCalledWith(expect.objectContaining({
      claimant_id: "conta-a", wp_post_id: 4415, status: "pendente",
    }));
    mock.auth.user = user("conta-b");
    view.rerender(<LegacyClaimPage />);
    expect(screen.queryByDisplayValue("4415")).toBeNull();
    await act(async () => pendingInsert.resolve({ error: null }));
    expect(screen.queryByText(/Pedido registrado/)).toBeNull();
    expect(screen.getByRole("button", { name: "Solicitar análise do meu cadastro" })).toBeTruthy();
  });
});
