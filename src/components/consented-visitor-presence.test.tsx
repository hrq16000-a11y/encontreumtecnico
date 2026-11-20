// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  send: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@/lib/visitor-http-presence", () => ({
  HTTP_PRESENCE_READY: true, // Preview only; the actual environment flags remain OFF.
  newPresenceTabToken: fake.token,
  sendPresenceLease: fake.send,
}));
import { ConsentedVisitorPresence } from "./consented-visitor-presence";

describe("adaptador HTTP de presença temporária consentida", () => {
  let nonce = 0;
  beforeEach(() => {
    localStorage.clear();
    fake.send.mockReset().mockResolvedValue(204);
    fake.token.mockReset().mockImplementation(() => (++nonce).toString(16).padStart(32, "0"));
  });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it("não envia HTTP sem consentimento específico, mesmo com analytics ativo", () => {
    localStorage.setItem("eut-cookie-consent", '{"analytics":true}');
    render(<ConsentedVisitorPresence pathname="/" />);
    expect(fake.send).not.toHaveBeenCalled();
  });

  it("inicia uma aba anônima e revoga imediatamente quando o consentimento é retirado", async () => {
    render(<ConsentedVisitorPresence pathname="/" />);
    localStorage.setItem("eut-cookie-consent", '{"presence":true}');
    await act(async () => { window.dispatchEvent(new Event("eut-consent-changed")); });
    await waitFor(() => expect(fake.send).toHaveBeenCalledWith("start", expect.stringMatching(/^[0-9a-f]{32}$/)));
    const token = fake.send.mock.calls[0]?.[1];
    localStorage.setItem("eut-cookie-consent", '{"presence":false}');
    await act(async () => { window.dispatchEvent(new Event("eut-consent-changed")); });
    expect(fake.send).toHaveBeenCalledWith("leave", token, true);
    expect(JSON.stringify(fake.send.mock.calls)).not.toMatch(/email|ip|city|url|user_id/);
  });

  it("retorna do BFCache apenas com nova chave e consentimento ainda ativo", async () => {
    localStorage.setItem("eut-cookie-consent", '{"presence":true}');
    render(<ConsentedVisitorPresence pathname="/" />);
    await waitFor(() => expect(fake.send).toHaveBeenCalledWith("start", expect.any(String)));
    const first = fake.send.mock.calls[0]?.[1];
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(fake.send).toHaveBeenCalledWith("leave", first, true);
    await act(async () => { window.dispatchEvent(new Event("pageshow")); });
    const starts = fake.send.mock.calls.filter(([op]) => op === "start");
    expect(starts).toHaveLength(2);
    expect(starts[1]?.[1]).not.toBe(first);
  });

  it("revoga em alteração de consentimento de outra aba", async () => {
    localStorage.setItem("eut-cookie-consent", '{"presence":true}');
    render(<ConsentedVisitorPresence pathname="/" />);
    await waitFor(() => expect(fake.send).toHaveBeenCalledWith("start", expect.any(String)));
    const first = fake.send.mock.calls[0]?.[1];
    localStorage.setItem("eut-cookie-consent", '{"presence":false}');
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: "eut-cookie-consent", oldValue: '{"presence":true}', newValue: '{"presence":false}',
      }));
    });
    expect(fake.send).toHaveBeenCalledWith("leave", first, true);
  });

  it("nunca sinaliza presença nas áreas administrativas", () => {
    localStorage.setItem("eut-cookie-consent", '{"presence":true}');
    render(<ConsentedVisitorPresence pathname="/admin/metricas" />);
    expect(fake.send).not.toHaveBeenCalled();
  });
});
