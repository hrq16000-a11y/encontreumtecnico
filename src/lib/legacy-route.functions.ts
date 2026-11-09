import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type LegacyRouteReference = {
  kind: "candidate" | "employer";
  slug: string;
  wp_post_id: number;
  display_name: string | null;
  status: "em_validacao";
};

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Only previously published, non-demo paths in a sanitized public table. */
export const getLegacyRouteReference = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({
    kind: z.enum(["candidate", "employer"]),
    slug: z.string().min(1).max(220),
  }).parse(input))
  .handler(async ({ data }): Promise<LegacyRouteReference | null> => {
    const { data: record, error } = await publicClient()
      .from("eut_legacy_url_routes")
      .select("kind,slug,wp_post_id,display_name,status")
      .eq("kind", data.kind)
      .eq("slug", data.slug)
      .eq("status", "em_validacao")
      .maybeSingle();
    if (error) throw new Error("Não foi possível consultar o registro histórico.");
    return (record as LegacyRouteReference | null) ?? null;
  });
