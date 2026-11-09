import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "tecnico" | "cliente";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load(u: User | null) {
      if (!active) return;
      setUser(u);
      if (u) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
        if (active) setRoles((data ?? []).map((r) => r.role as Role));
      } else setRoles([]);
      if (active) setLoading(false);
    }
    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED")
        load(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refreshRoles() {
    if (!user) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setRoles((data ?? []).map((r) => r.role as Role));
  }

  return { user, roles, loading, refreshRoles };
}

export function signInWithGoogle(next = "/entrar") {
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/entrar";
  sessionStorage.setItem("eut-after-login", safe);
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/entrar` },
  });
}
