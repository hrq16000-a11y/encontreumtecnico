/**
 * Google OAuth may sever window.opener through browser COOP.
 * This helper only reacts to signals; it always revalidates the session with Supabase.
 * It never transfers auth tokens between windows.
 */
type PopupWindow = Pick<Window, "closed">;
type PopupReturnOptions = {
  popup: PopupWindow;
  origin: string;
  verifySession: () => Promise<boolean>;
  onVerified: () => void;
  onFailure: () => void;
  onClosed: () => void;
};

export function watchGooglePopupReturn({
  popup, origin, verifySession, onVerified, onFailure, onClosed,
}: PopupReturnOptions): () => void {
  let stopped = false;
  let checking = false;
  let closedReported = false;

  function stop() {
    if (stopped) return;
    stopped = true;
    window.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", onFocus);
    window.clearInterval(closedCheck);
    window.clearTimeout(expiry);
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
    if (stopped || event.origin !== origin || event.source !== popup) return;
    if (event.data?.type === "eut:google-oauth-error") {
      stop();
      onFailure();
    } else if (event.data?.type === "eut:google-oauth-complete") {
      void confirmSession(true);
    }
  }

  function onStorage(event: StorageEvent) {
    // Some browsers remove window.opener via COOP. Same-origin auth storage
    // will still propagate, but no storage event is itself an auth proof.
    if (event.storageArea === window.localStorage) void confirmSession();
  }

  function onFocus() {
    // Covers returning to the original tab after OAuth closes a popup.
    // No automatic failure: a COOP-isolated popup can appear closed early.
    void confirmSession();
  }

  const closedCheck = window.setInterval(() => {
    try {
      if (!closedReported && popup.closed) {
        closedReported = true;
        void confirmSession();
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
