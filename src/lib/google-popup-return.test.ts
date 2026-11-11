// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { watchGooglePopupReturn } from "./google-popup-return";

function popupMessage(origin: string, source: unknown, type: string) {
  const event = new MessageEvent("message", { origin, data: { type } });
  Object.defineProperty(event, "source", { value: source });
  window.dispatchEvent(event);
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => { vi.useRealTimers(); });

describe("Google popup return coordination", () => {
  it("ignores foreign-origin or unrelated windows, never trusting arbitrary messages", async () => {
    const popup = { closed: false } as Window;
    const verify = vi.fn().mockResolvedValue(true);
    const success = vi.fn();
    const stop = watchGooglePopupReturn({
      popup, origin: "https://www.encontreumtecnico.com.br",
      verifySession: verify, onVerified: success, onFailure: vi.fn(), onClosed: vi.fn(),
    });
    popupMessage("https://malicious.example", popup, "eut:google-oauth-complete");
    popupMessage("https://www.encontreumtecnico.com.br", {}, "eut:google-oauth-complete");
    await flush();
    expect(verify).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    stop();
  });

  it("requires successful server verification even after trusted completion", async () => {
    const popup = { closed: false } as Window;
    const verify = vi.fn().mockResolvedValue(false);
    const onVerified = vi.fn(), onFailure = vi.fn();
    watchGooglePopupReturn({
      popup, origin: window.location.origin,
      verifySession: verify, onVerified, onFailure, onClosed: vi.fn(),
    });
    popupMessage(window.location.origin, popup, "eut:google-oauth-complete");
    await flush();
    expect(verify).toHaveBeenCalledOnce();
    expect(onVerified).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("finishes when same-origin storage changes even if COOP breaks opener", async () => {
    const popup = { closed: true } as Window;
    const verify = vi.fn().mockResolvedValue(true);
    const onVerified = vi.fn(), onFailure = vi.fn();
    watchGooglePopupReturn({
      popup, origin: window.location.origin,
      verifySession: verify, onVerified, onFailure, onClosed: vi.fn(),
    });
    window.dispatchEvent(new StorageEvent("storage", { key: "sb-session", storageArea: window.localStorage }));
    await flush();
    expect(verify).toHaveBeenCalledOnce();
    expect(onVerified).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("releases dialog when popup closes but continues waiting for verified storage", async () => {
    vi.useFakeTimers();
    const popup = { closed: true } as Window;
    const onClosed = vi.fn(), onVerified = vi.fn(), onFailure = vi.fn();
    const verify = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    watchGooglePopupReturn({
      popup, origin: window.location.origin, verifySession: verify,
      onVerified, onFailure, onClosed,
    });
    await vi.advanceTimersByTimeAsync(650);
    expect(onClosed).toHaveBeenCalledOnce();
    window.dispatchEvent(new StorageEvent("storage", { key: "sb-session", storageArea: window.localStorage }));
    await flush();
    expect(onVerified).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("handles network verification failure without unhandled promises, and expires cleanly", async () => {
    vi.useFakeTimers();
    const popup = { closed: false } as Window;
    const onVerified = vi.fn(), onFailure = vi.fn();
    watchGooglePopupReturn({
      popup, origin: window.location.origin,
      verifySession: vi.fn().mockRejectedValue(new Error("network")),
      onVerified, onFailure, onClosed: vi.fn(),
    });
    popupMessage(window.location.origin, popup, "eut:google-oauth-complete");
    await flush();
    expect(onFailure).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(onFailure).toHaveBeenCalledOnce();
  });
});
