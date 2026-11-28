import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HTTP_PRESENCE_READY,
  newPresenceTabToken,
  readAdminPresenceCount,
  sendPresenceLease,
} from "./visitor-http-presence";

afterEach(() => vi.unstubAllGlobals());

describe("contrato de adaptação HTTP sem endpoints oficiais", () => {
  it("permanece desligado sem as duas flags explícitas e cria token aleatório de 128 bits", () => {
    expect(HTTP_PRESENCE_READY).toBe(false);
    const token = newPresenceTabToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(newPresenceTabToken()).not.toBe(token);
  });

  it("envia somente token e intenção de consentimento, sem cookies ou dados pessoais", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const token = "a".repeat(32);
    expect(await sendPresenceLease("start", token)).toBe(204);
    expect(await sendPresenceLease("leave", token, true)).toBe(204);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST", credentials: "omit", cache: "no-store",
      body: JSON.stringify({ op: "start", tabToken: token, consent: true }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      keepalive: true, body: JSON.stringify({ op: "leave", tabToken: token }),
    });
  });

  it("aceita apenas agregado administrativo válido e nunca converte erro em zero", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ activeConsentedTabs: 3, checkedAt: new Date().toISOString() }) })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    vi.stubGlobal("fetch", fetchMock);
    expect(await readAdminPresenceCount("synthetic.jwt.token")).toBe(3);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "omit", cache: "no-store", headers: { Authorization: "Bearer synthetic.jwt.token" },
    });
    await expect(readAdminPresenceCount("synthetic.jwt.token")).rejects.toThrow("Private count unavailable");
    await expect(readAdminPresenceCount("")).rejects.toThrow("Missing authenticated session");
  });
});
