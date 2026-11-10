// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { LegacyAccountActivation } from "./legacy-account-activation";
import { LegacyProfileImport } from "./legacy-profile-import";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

const oldAccount = (name: string) => ({
  data: [{ legacy_name: name, intended_type: "tecnico", directory_profiles: 1, activation_state: "aguardando_titular" }],
  error: null,
});
const oldProfiles = (name: string) => ({
  data: [{
    wp_post_id: name === "Perfil A" ? 530 : 531,
    legacy_name: name,
    legacy_bio: "Apresentação histórica",
    legacy_specialty: "Suporte técnico",
    legacy_location1: null,
    legacy_location2: null,
    legacy_location3: null,
  }],
  error: null,
});

describe("isolamento de dados WordPress após troca de conta", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("não mostra conta WP da pessoa A enquanto carrega a conta B", async () => {
    const pendingB = deferred<ReturnType<typeof oldAccount>>();
    mocks.rpc.mockImplementationOnce(() => Promise.resolve(oldAccount("Titular A")))
      .mockImplementationOnce(() => pendingB.promise);
    const view = render(<LegacyAccountActivation userId="usuario-a" role="tecnico" />);
    expect(await screen.findByText("Titular A")).toBeTruthy();

    view.rerender(<LegacyAccountActivation userId="usuario-b" role="tecnico" />);
    expect(screen.queryByText("Titular A")).toBeNull();
    expect(screen.queryByRole("button", { name: "Associar minha conta antiga" })).toBeNull();

    await act(async () => { pendingB.resolve(oldAccount("Titular B")); });
    expect(await screen.findByText("Titular B")).toBeTruthy();
    expect(screen.queryByText("Titular A")).toBeNull();
  });

  it("descarta resposta de vínculo da conta anterior após troca de login", async () => {
    const pendingLink = deferred<{ data: { state: string; profiles_linked: number }; error: null }>();
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "eut_my_legacy_account") {
        return Promise.resolve(oldAccount(mocks.rpc.mock.calls.filter(([key]) => key === name).length === 1 ? "Titular A" : "Titular B"));
      }
      if (name === "eut_confirm_my_legacy_account") return pendingLink.promise;
      throw new Error("RPC inesperada");
    });
    const view = render(<LegacyAccountActivation userId="usuario-a" role="tecnico" />);
    expect(await screen.findByText("Titular A")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Associar minha conta antiga" }));

    view.rerender(<LegacyAccountActivation userId="usuario-b" role="tecnico" />);
    expect(screen.queryByText("Titular A")).toBeNull();
    expect(await screen.findByText("Titular B")).toBeTruthy();

    await act(async () => { pendingLink.resolve({ data: { state: "vinculada", profiles_linked: 1 }, error: null }); });
    expect(screen.queryByText(/Conta antiga associada com sucesso/i)).toBeNull();
    expect(screen.queryByText(/perfil\(is\) profissional/i)).toBeNull();
    expect(screen.getByText("Titular B")).toBeTruthy();
  });

  it("não revela perfis do titular anterior nem permite aplicar perfil antigo", async () => {
    const pendingB = deferred<ReturnType<typeof oldProfiles>>();
    const useProfile = vi.fn();
    mocks.rpc.mockImplementationOnce(() => Promise.resolve(oldProfiles("Perfil A")))
      .mockImplementationOnce(() => pendingB.promise);

    const view = render(<LegacyProfileImport userId="usuario-a" onUse={useProfile} />);
    expect(await screen.findByText("Perfil A")).toBeTruthy();
    view.rerender(<LegacyProfileImport userId="usuario-b" onUse={useProfile} />);
    expect(screen.queryByText("Perfil A")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reutilizar nome e apresentação" })).toBeNull();

    await act(async () => { pendingB.resolve(oldProfiles("Perfil B")); });
    expect(await screen.findByText("Perfil B")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reutilizar nome e apresentação" }));
    expect(useProfile).toHaveBeenCalledOnce();
    expect(useProfile).toHaveBeenCalledWith({ display_name: "Perfil B", bio: "Apresentação histórica" });
  });

  it("não oferece vínculo de papel divergente na recuperação WordPress", async () => {
    mocks.rpc.mockResolvedValue(oldAccount("Titular técnico"));
    render(<LegacyAccountActivation userId="usuario-a" role="cliente" />);
    expect(await screen.findByText("Titular técnico")).toBeTruthy();
    expect(screen.getByText(/outro tipo de conta/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Associar minha conta antiga" })).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("eut_my_legacy_account");
  });

  it("ignora consulta de perfil da conta A que termina depois da conta B", async () => {
    const pendingA = deferred<ReturnType<typeof oldProfiles>>();
    mocks.rpc.mockImplementationOnce(() => pendingA.promise)
      .mockImplementationOnce(() => Promise.resolve(oldProfiles("Perfil B")));
    const view = render(<LegacyProfileImport userId="usuario-a" onUse={vi.fn()} />);
    view.rerender(<LegacyProfileImport userId="usuario-b" onUse={vi.fn()} />);
    expect(await screen.findByText("Perfil B")).toBeTruthy();
    await act(async () => { pendingA.resolve(oldProfiles("Perfil A")); });
    await waitFor(() => expect(screen.queryByText("Perfil A")).toBeNull());
    expect(screen.getByText("Perfil B")).toBeTruthy();
  });
});
