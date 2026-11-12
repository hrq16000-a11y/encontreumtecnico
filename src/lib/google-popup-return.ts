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
  verifySession: (callbackUserId: string) => Promise<boolean>;
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
  let callbackUserId: string | null = null;
  const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Only a matching callback signal proves that this OAuth attempt returned.
  // Existing account sessions must not be mistaken for a new Google login.
  const proofKey = `eut-google-popup-result:${nonce}`;
  function callbackProof(): string | null {
    try { return window.localStorage.getItem(proofKey); }
    catch { return null; }
  }
  function handleProof(value: string | null) {
    if (stopped) return;
    if (value === "error") { stop(); onFailure(); return; }
    if (!value?.startsWith("complete:")) return;
    const id = value.slice("complete:".length);
    if (!userIdPattern.test(id)) return;
    callbackUserId = id;
    void confirmSession();
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

  async function confirmSession() {
    if (stopped || checking || !callbackUserId) return;
    checking = true;
    let verified = false;
    try {
      // The callback identifies B, but the opener may still hold A briefly.
      // The server must confirm the *same* account before continuing.
      verified = await verifySession(callbackUserId);
    } catch {
      // Auth may be unavailable during navigation; allow later recheck.
    } finally {
      checking = false;
    }
    if (stopped) return;
    if (verified) {
      stop();
      onVerified();
    }
    // A mismatch can be temporary while Supabase synchronizes tabs; do not
    // grant A access or fail permanently before callback timeout.
  }

  function onMessage(event: MessageEvent) {
    if (stopped || event.origin !== origin || event.source !== popup || event.data?.nonce !== nonce) return;
    if (event.data?.type === "eut:google-oauth-error") {
      stop();
      onFailure();
    } else if (event.data?.type === "eut:google-oauth-complete") {
      const id = event.data?.userId;
      if (typeof id !== "string" || !userIdPattern.test(id)) return;
      callbackUserId = id;
      void confirmSession();
    }
  }

  function onStorage(event: StorageEvent) {
    // COOP may sever opener; only a same-attempt callback marker can trigger
    // server verification. Generic Supabase storage updates are not proof.
    if (event.storageArea !== window.localStorage) return;
    if (event.key === proofKey) handleProof(event.newValue);
    else if (callbackUserId && event.key?.startsWith("sb-")) {
      // A matching callback exists; a later Supabase storage update may
      // have replaced A with B. This event alone never grants access.
      void confirmSession();
    }
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
