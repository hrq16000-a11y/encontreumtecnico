import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "tecnico" | "cliente";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesError, setRolesError] = useState(false);

  useEffect(() => {
    let active = true;
    let generation = 0;
    let subscription: { unsubscribe: () => void } | undefined;

    // Role queries run after auth initialization and outside the synchronous
    // onAuthStateChange callback. Stale queries must never overwrite a later login.
    async function syncUser(nextUser: User | null) {
      const request = ++generation;
      if (!active) return;
      setUser(nextUser);
      if (!nextUser) {
        setRoles([]);
        setRolesError(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.from("user_roles")
          .select("role").eq("user_id", nextUser.id);
        if (!active || request !== generation) return;
        if (error) {
          setRoles([]);
          setRolesError(true);
        } else {
          setRoles((data ?? []).map((r) => r.role as Role));
          setRolesError(false);
        }
      } catch {
        if (!active || request !== generation) return;
        setRoles([]);
        setRolesError(true);
      } finally {
        if (active && request === generation) setLoading(false);
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
    if (!user) return;
    const { data, error } = await supabase.from("user_roles")
      .select("role").eq("user_id", user.id);
    if (error) {
      setRolesError(true);
      return;
    }
    setRoles((data ?? []).map((r) => r.role as Role));
    setRolesError(false);
  }

  return { user, roles, loading, rolesError, refreshRoles };
}

export function signInWithGoogle(next = "/entrar") {
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/entrar";
  sessionStorage.setItem("eut-after-login", safe);
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/entrar` },
  });
}
