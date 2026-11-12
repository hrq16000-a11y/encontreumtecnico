// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { watchGooglePopupReturn } from "./google-popup-return";

function popupMessage(origin: string, source: unknown, type: string) {
  const event = new MessageEvent("message", {
    origin, data: { type, nonce: "qa-nonce", userId: "00000000-0000-4000-8000-000000000012" },
  });
  Object.defineProperty(event, "source", { value: source });
  window.dispatchEvent(event);
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => { window.localStorage.clear(); vi.useRealTimers(); });

describe("Google popup return coordination", () => {
  it("ignores foreign-origin or unrelated windows, never trusting arbitrary messages", async () => {
    const popup = { closed: false } as Window;
    const verify = vi.fn().mockResolvedValue(true);
    const success = vi.fn();
    const stop = watchGooglePopupReturn({
      popup, origin: "https://www.encontreumtecnico.com.br", nonce: "qa-nonce",
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
    const stop = watchGooglePopupReturn({
      popup, origin: window.location.origin, nonce: "qa-nonce",
      verifySession: verify, onVerified, onFailure, onClosed: vi.fn(),
    });
    popupMessage(window.location.origin, popup, "eut:google-oauth-complete");
    await flush();
    expect(verify).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000012");
    expect(onVerified).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled(); // Wait for matching account, not A.
    stop();
  });

  it("finishes when same-origin storage changes even if COOP breaks opener", async () => {
    const popup = { closed: true } as Window;
    const verify = vi.fn().mockResolvedValue(true);
    const onVerified = vi.fn(), onFailure = vi.fn();
    watchGooglePopupReturn({
      popup, origin: window.location.origin, nonce: "qa-nonce",
      verifySession: verify, onVerified, onFailure, onClosed: vi.fn(),
    });
    window.localStorage.setItem("eut-google-popup-result:qa-nonce", "complete:00000000-0000-4000-8000-000000000012");
    window.dispatchEvent(new StorageEvent("storage", { key: "eut-google-popup-result:qa-nonce", newValue: "complete:00000000-0000-4000-8000-000000000012", storageArea: window.localStorage }));
    await flush();
    expect(verify).toHaveBeenCalledOnce();
    expect(onVerified).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("releases dialog when popup closes but continues waiting for verified storage", async () => {
    vi.useFakeTimers();
    const popup = { closed: true } as Window;
    const onClosed = vi.fn(), onVerified = vi.fn(), onFailure = vi.fn();
    const verify = vi.fn().mockResolvedValue(true);
    watchGooglePopupReturn({
      popup, origin: window.location.origin, nonce: "qa-nonce", verifySession: verify,
      onVerified, onFailure, onClosed,
    });
    await vi.advanceTimersByTimeAsync(650);
    expect(onClosed).toHaveBeenCalledOnce();
    expect(verify).not.toHaveBeenCalled(); // Closing the popup alone is not callback proof.
    window.localStorage.setItem("eut-google-popup-result:qa-nonce", "complete:00000000-0000-4000-8000-000000000012");
    window.dispatchEvent(new StorageEvent("storage", { key: "eut-google-popup-result:qa-nonce", newValue: "complete:00000000-0000-4000-8000-000000000012", storageArea: window.localStorage }));
    await flush();
    expect(onVerified).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("does not accept a pre-existing session from focus, unrelated storage or COOP closed events", async () => {
    vi.useFakeTimers();
    const popup = { closed: true } as Window;
    const verify = vi.fn().mockResolvedValue(true); // A different account is already signed in.
    const onVerified = vi.fn(), onClosed = vi.fn();
    const stop = watchGooglePopupReturn({
      popup, origin: window.location.origin, nonce: "qa-nonce",
      verifySession: verify, onVerified, onFailure: vi.fn(), onClosed,
    });
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new StorageEvent("storage", { key: "sb-session", storageArea: window.localStorage }));
    await vi.advanceTimersByTimeAsync(650);
    expect(onClosed).toHaveBeenCalledOnce();
    expect(verify).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();
    // Even a legitimate-looking message must match this attempt's nonce.
    const mismatched = new MessageEvent("message", {
      origin: window.location.origin, data: { type: "eut:google-oauth-complete", nonce: "other" },
    });
    Object.defineProperty(mismatched, "source", { value: popup });
    window.dispatchEvent(mismatched);
    await flush();
    expect(verify).not.toHaveBeenCalled();
    stop();
  });

  it("waits for account B when account A is still active after a legitimate callback", async () => {
    const popup = { closed: false } as Window;
    let currentUserId = "00000000-0000-4000-8000-000000000011";
    const verify = vi.fn().mockImplementation(async (callbackId: string) => currentUserId === callbackId);
    const onVerified = vi.fn(), onFailure = vi.fn();
    const stop = watchGooglePopupReturn({
      popup, origin: window.location.origin, nonce: "qa-nonce",
      verifySession: verify, onVerified, onFailure, onClosed: vi.fn(),
    });
    popupMessage(window.location.origin, popup, "eut:google-oauth-complete");
    await flush();
    expect(verify).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000012");
    expect(onVerified).not.toHaveBeenCalled(); // The previous user A is not B.
    expect(onFailure).not.toHaveBeenCalled();
    currentUserId = "00000000-0000-4000-8000-000000000012";
    window.dispatchEvent(new StorageEvent("storage", {
      key: "sb-synthetic-auth-token", storageArea: window.localStorage,
    }));
    await flush();
    expect(onVerified).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
    stop();
  });

  it("handles network verification failure without unhandled promises, and expires cleanly", async () => {
    vi.useFakeTimers();
    const popup = { closed: false } as Window;
    const onVerified = vi.fn(), onFailure = vi.fn();
    watchGooglePopupReturn({
      popup, origin: window.location.origin, nonce: "qa-nonce",
      verifySession: vi.fn().mockRejectedValue(new Error("network")),
      onVerified, onFailure, onClosed: vi.fn(),
    });
    popupMessage(window.location.origin, popup, "eut:google-oauth-complete");
    await flush();
    expect(onFailure).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(onFailure).toHaveBeenCalledOnce();
  });
});
