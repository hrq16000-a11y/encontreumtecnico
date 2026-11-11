import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { canAcceptAccountResult } from "@/lib/account-scoped-queries";
import { authReturnUrl } from "@/lib/auth-domain";

export type Role = "admin" | "tecnico" | "cliente";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesError, setRolesError] = useState(false);
  const accountIdRef = useRef<string | null>(null);
  const roleLookupVersion = useRef(0);
  // SIGNED_IN is also emitted when an existing user revisits a browser tab.
  // Do not make every page temporarily reload its auth-dependent controls.
  const settledUserIdRef = useRef<string | null>(null);
  const pendingUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let generation = 0;
    let subscription: { unsubscribe: () => void } | undefined;

    // Role queries run after auth initialization and outside the synchronous
    // onAuthStateChange callback. Stale queries must never overwrite a later login.
    async function syncUser(nextUser: User | null) {
      if (!active) return;
      const nextId = nextUser?.id ?? null;
      if (nextId && accountIdRef.current === nextId &&
          (settledUserIdRef.current === nextId || pendingUserIdRef.current === nextId)) {
        // Updating user metadata is safe; reloading roles and toggling
        // "loading" makes forms disappear and loses the input focus.
        setUser(nextUser);
        return;
      }
      const request = ++generation;
      const roleVersion = ++roleLookupVersion.current;
      // Different identities must never inherit a previous user's roles,
      // even for one render while Supabase is looking up the new account.
      if (accountIdRef.current !== nextId) {
        setRoles([]);
        setRolesError(false);
        settledUserIdRef.current = null;
        pendingUserIdRef.current = null;
      }
      accountIdRef.current = nextId;
      pendingUserIdRef.current = nextId;
      setLoading(true);
      setUser(nextUser);
      if (!nextUser) {
        settledUserIdRef.current = null;
        pendingUserIdRef.current = null;
        setRoles([]);
        setRolesError(false);
        setLoading(false);
        return;
      }

      const current = () => active && request === generation &&
        canAcceptAccountResult(nextUser.id, accountIdRef.current, roleVersion, roleLookupVersion.current);
      try {
        const { data, error } = await supabase.from("user_roles")
          .select("role").eq("user_id", nextUser.id);
        if (!current()) return;
        if (error) {
          setRoles([]);
          setRolesError(true);
        } else {
          setRoles((data ?? []).map((r) => r.role as Role));
          setRolesError(false);
        }
      } catch {
        if (!current()) return;
        setRoles([]);
        setRolesError(true);
      } finally {
        if (current()) {
          settledUserIdRef.current = nextId;
          pendingUserIdRef.current = null;
          setLoading(false);
        }
      }
    }

    async function start() {
      try {
        // getUser completes initialization, including any OAuth return URL,
        // before we register the listener and begin fetching custom roles.
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error && data.user === null) {
          // Missing session is a normal logged-out state.
          await syncUser(null);
        } else {
          await syncUser(data.user);
        }
      } catch {
        if (active) await syncUser(null);
      }
      if (!active) return;
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (
          event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          event === "SIGNED_OUT" ||
          event === "USER_UPDATED"
        ) {
          // Do not query Supabase from inside its auth event callback:
          // schedule after the auth notification and ignore stale results.
          queueMicrotask(() => { if (active) void syncUser(session?.user ?? null); });
        }
      });
      subscription = listener.subscription;
    }

    void start();
    return () => {
      active = false;
      generation++;
      subscription?.unsubscribe();
    };
  }, []);

  async function refreshRoles() {
    const owner = user?.id;
    if (!owner || accountIdRef.current !== owner) return;
    const version = ++roleLookupVersion.current;
    const current = () => canAcceptAccountResult(owner, accountIdRef.current, version, roleLookupVersion.current);
    setLoading(true);
    try {
      const { data, error } = await supabase.from("user_roles")
        .select("role").eq("user_id", owner);
      if (!current()) return;
      if (error) {
        setRoles([]);
        setRolesError(true);
      } else {
        setRoles((data ?? []).map((r) => r.role as Role));
        setRolesError(false);
      }
    } catch {
      if (!current()) return;
      setRoles([]);
      setRolesError(true);
    } finally {
      if (current()) setLoading(false);
    }
  }

  return { user, roles, loading, rolesError, refreshRoles };
}

export function signInWithGoogle(next = "/entrar") {
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/entrar";
  sessionStorage.setItem("eut-after-login", safe);
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authReturnUrl("/entrar", window.location.origin) },
  });
}
