/**
 * Google OAuth may sever window.opener through browser COOP.
 * This helper only reacts to signals; it always revalidates the session with Supabase.
 * It never transfers auth tokens between windows.
 */
type PopupWindow = Pick<Window, "closed">;
type PopupReturnOptions = {
  popup: PopupWindow;
  origin: string;
  nonce: string;
  verifySession: () => Promise<boolean>;
  onVerified: () => void;
  onFailure: () => void;
  onClosed: () => void;
};

export function watchGooglePopupReturn({
  popup, origin, nonce, verifySession, onVerified, onFailure, onClosed,
}: PopupReturnOptions): () => void {
  let stopped = false;
  let checking = false;
  let closedReported = false;
  // Only a matching callback signal proves that this OAuth attempt returned.
  // Existing account sessions must not be mistaken for a new Google login.
  const proofKey = `eut-google-popup-result:${nonce}`;
  function callbackProof(): string | null {
    try { return window.localStorage.getItem(proofKey); }
    catch { return null; }
  }
  function handleProof(value: string | null) {
    if (stopped) return;
    if (value === "complete") void confirmSession();
    else if (value === "error") { stop(); onFailure(); }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    window.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", onFocus);
    window.clearInterval(closedCheck);
    window.clearTimeout(expiry);
    try { window.localStorage.removeItem(proofKey); } catch { /* Unavailable storage. */ }
  }

  async function confirmSession(fromPopupMessage = false) {
    if (stopped || checking) return;
    checking = true;
    let verified = false;
    try {
      verified = await verifySession();
    } catch {
      // Auth may be unavailable during navigation; wait for the next signal.
    } finally {
      checking = false;
    }
    if (stopped) return;
    if (verified) {
      stop();
      onVerified();
    } else if (fromPopupMessage) {
      stop();
      onFailure();
    }
  }

  function onMessage(event: MessageEvent) {
    if (stopped || event.origin !== origin || event.source !== popup || event.data?.nonce !== nonce) return;
    if (event.data?.type === "eut:google-oauth-error") {
      stop();
      onFailure();
    } else if (event.data?.type === "eut:google-oauth-complete") {
      void confirmSession(true);
    }
  }

  function onStorage(event: StorageEvent) {
    // COOP may sever opener; only a same-attempt callback marker can trigger
    // server verification. Generic Supabase storage updates are not proof.
    if (event.storageArea === window.localStorage && event.key === proofKey)
      handleProof(event.newValue);
  }

  function onFocus() {
    // A pre-existing valid session is not evidence of this OAuth attempt.
    // Re-check only when the callback itself left a matching marker.
    handleProof(callbackProof());
  }

  const closedCheck = window.setInterval(() => {
    try {
      if (!closedReported && popup.closed) {
        closedReported = true;
        handleProof(callbackProof());
        // Do not stop listening: COOP can report closed before Auth completes.
        onClosed();
      }
    } catch {
      // Cross-origin WindowProxy may stop exposing status; storage is fallback.
    }
  }, 650);
  const expiry = window.setTimeout(() => {
    if (!stopped) {
      stop();
      onFailure();
    }
  }, 120_000);

  window.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", onFocus);
  return stop;
}
