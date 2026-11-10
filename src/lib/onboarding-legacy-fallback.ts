/**
 * The WordPress-derived snapshot is an OPTIONAL discovery step for new signups.
 * Only the server's choose_account_type RPC is allowed to assign a role:
 * it checks verified identity and existing roles. The imported role is only a
 * historical hint for an optional recovery; it does not dictate the new role.
 *
 * If the discovery RPC fails, show a tentative self-registration choice instead
 * of blocking every genuine newcomer. This must NOT auto-assign a role.
 */
export function canAttemptNewAccountRole(state: {
  legacyChecked: boolean;
  legacyLookupError: boolean;
  legacyRole: "tecnico" | "cliente" | null;
}): boolean {
  return state.legacyChecked || (state.legacyLookupError && state.legacyRole === null);
}
