// QA-only Vite configuration: refuse to boot without ephemeral local Supabase.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

const localApi = process.env["SUPABASE_URL"];
const localKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
if (localApi !== "http://127.0.0.1:54321" || !localKey || localKey !== process.env["ANON_KEY"]) {
  throw new Error("FAIL CLOSED: QA requires the local API and its ephemeral anonymous key");
}
if (process.env["SUPABASE_SERVICE_ROLE_KEY"] !== process.env["SERVICE_ROLE_KEY"]) {
  throw new Error("FAIL CLOSED: service role must be ephemeral and local");
}

// The checked-in generated client embeds the OFFICIAL Supabase URL/key.
// Replace them only in Vite's in-memory QA transform; never touch its source.
// If its syntax changes, stop rather than silently use the official endpoint.
function forceLocalBrowserClient(): Plugin {
  return {
    name: "eut-qa-force-local-supabase",
    enforce: "pre",
    transform(code, id) {
      const path = id.replaceAll("\\", "/").split("?")[0];
      if (!path.endsWith("/src/integrations/supabase/client.ts")) return;
      const urls = code.match(/const SUPABASE_URL = "https:\/\/[a-z0-9]+\.supabase\.co";/g);
      const keys = code.match(/const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_[^"]+";/g);
      if (urls?.length !== 1 || keys?.length !== 1) {
        throw new Error("FAIL CLOSED: cannot safely replace generated Supabase client");
      }
      return {
        code: code.replace(urls[0], "const SUPABASE_URL = " + JSON.stringify(localApi) + ";")
          .replace(keys[0], "const SUPABASE_PUBLISHABLE_KEY = " + JSON.stringify(localKey) + ";"),
        map: null,
      };
    },
  };
}

export default defineConfig({
  vite: {
    plugins: [forceLocalBrowserClient()],
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
  },
});
