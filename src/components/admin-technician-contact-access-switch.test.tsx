// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { AdminTechnicianContactAccess } from "./admin-technician-contact-access";

type ContactResponse = {
  data: { ok: true; available: true; phone: string; contact_suspended: boolean };
  error: null;
};

const resolvers = new Map<string, (response: ContactResponse) => void>();

function returnPhone(key: string, phone: string, suspended = false) {
  const resolve = resolvers.get(key);
  if (!resolve) throw new Error("Missing mocked request for " + key);
  resolve({
    data: { ok: true, available: true, phone, contact_suspended: suspended },
    error: null,
  });
}

beforeEach(() => {
  resolvers.clear();
  rpc.mockReset();
  rpc.mockImplementation((_name: string, args: { _record_key: string }) =>
    new Promise<ContactResponse>((resolve) => { resolvers.set(args._record_key, resolve); }),
  );
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("contato privado: isolamento entre fichas administrativas", () => {
  it("não exibe o telefone anterior enquanto carrega outra ficha", async () => {
    const { rerender } = render(<AdminTechnicianContactAccess recordKey="registry:qa-a" />);
    await act(async () => returnPhone("registry:qa-a", "+5541999990001", true));
    expect(screen.getByText(/\+5541999990001/)).toBeTruthy();
    expect(screen.getByText(/contato suspenso/)).toBeTruthy();

    rerender(<AdminTechnicianContactAccess recordKey="registry:qa-b" />);
    expect(document.body.textContent).not.toContain("+5541999990001");
    expect(document.body.textContent).not.toContain("contato suspenso");
    expect(screen.queryByRole("button", { name: "Copiar telefone" })).toBeNull();
    expect(screen.getByText("Telefone: carregando…")).toBeTruthy();

    await act(async () => returnPhone("registry:qa-b", "+5541999990002"));
    expect(screen.getByText(/\+5541999990002/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("+5541999990001");
  });

  it("uma cópia antiga concluída depois da troca não marca a nova ficha como copiada", async () => {
    let completeCopy: (() => void) | undefined;
    const writeText = vi.fn(() => new Promise<void>((resolve) => { completeCopy = resolve; }));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true, value: { writeText },
    });
    const { rerender } = render(<AdminTechnicianContactAccess recordKey="registry:qa-a" />);
    await act(async () => returnPhone("registry:qa-a", "+5541999990001"));

    fireEvent.click(screen.getByRole("button", { name: "Copiar telefone" }));
    expect(writeText).toHaveBeenCalledWith("+5541999990001");

    rerender(<AdminTechnicianContactAccess recordKey="registry:qa-b" />);
    await act(async () => returnPhone("registry:qa-b", "+5541999990002"));
    expect(screen.getByRole("button", { name: "Copiar telefone" }).textContent).toContain("Copiar");
    await act(async () => completeCopy?.());
    expect(screen.getByRole("button", { name: "Copiar telefone" }).textContent).toContain("Copiar");
    expect(screen.getByRole("button", { name: "Copiar telefone" }).textContent).not.toContain("Copiado");
  });
});
