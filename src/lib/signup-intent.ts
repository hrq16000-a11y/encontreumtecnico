/** A chosen signup path is a UI preference only, never an access role. */
export type SignupIntent = "tecnico" | "cliente";
const KEY = "eut-signup-intent";
export function normalizeSignupIntent(value: unknown): SignupIntent | null {
  return value === "tecnico" || value === "cliente" ? value : null;
}
export function rememberSignupIntent(intent: SignupIntent): void {
  if (typeof window !== "undefined") sessionStorage.setItem(KEY, intent);
}
export function readSignupIntent(): SignupIntent | null {
  if (typeof window === "undefined") return null;
  try { return normalizeSignupIntent(sessionStorage.getItem(KEY)); }
  catch { return null; }
}
export function clearSignupIntent(): void {
  if (typeof window !== "undefined") {
    try { sessionStorage.removeItem(KEY); } catch { /* ignored */ }
  }
}
