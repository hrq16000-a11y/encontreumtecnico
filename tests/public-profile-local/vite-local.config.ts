// QA-only Vite config: never load the generated client containing the official URL.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

const localApi = "http://127.0.0.1:54321";
const localKey = process.env["ANON_KEY"];
if (process.env["SUPABASE_URL"] !== localApi ||
    process.env["VITE_SUPABASE_URL"] !== localApi ||
    !localKey ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] !== localKey ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] !== localKey ||
    !process.env["SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"] !== process.env["SERVICE_ROLE_KEY"] ||
    process.env["QA_EGRESS_FIREWALL"] !== "enforced") {
  throw Error("FAIL CLOSED: QA requires ephemeral localhost credentials and OS firewall");
}
const originalPath = resolve(process.cwd(), "src/integrations/supabase/client.ts").replaceAll("\\", "/");
const original = readFileSync(originalPath, "utf8");
if ((original.match(/const SUPABASE_URL = "https:\/\/[a-z0-9]+\.supabase\.co";/g) ?? []).length !== 1 ||
    (original.match(/const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_[^"]+";/g) ?? []).length !== 1) {
  throw Error("FAIL CLOSED: unexpected generated Supabase client format");
}
const virtualId = "\0eut-qa-local-client";
let intercepted = 0;

function enforceLocalClient(): Plugin {
  return {
    name: "eut-qa-local-supabase-client",
    enforce: "pre",
    resolveId(source) {
      const file = source.replaceAll("\\", "/").split("?")[0];
      if (source === "@/integrations/supabase/client" ||
          source === "@/integrations/supabase/client.ts" ||
          file === originalPath) {
        intercepted++;
        return virtualId;
      }
    },
    load(id) {
      if (id === virtualId) {
        return [
          'import { createClient } from "@supabase/supabase-js";',
          'import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";',
          'export const supabase = createClient(' +
            JSON.stringify(localApi) + ', ' + JSON.stringify(localKey) +
            ', { auth: { storage: brokeredPreviewStorage(), persistSession: true, autoRefreshToken: true } });',
        ].join("\n");
      }
      if (id.replaceAll("\\", "/").split("?")[0] === originalPath) {
        throw Error("FAIL CLOSED: unmodified official Supabase client reached the QA bundle");
      }
    },
    configureServer(server) {
      server.middlewares.use("/__eut_qa_local_client", (_req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        res.statusCode = intercepted > 0 ? 200 : 503;
        res.end(JSON.stringify({ intercepted: intercepted > 0 }));
      });
    },
  };
}
export default defineConfig({
  tanstackStart: {
    // Match the official vite.config.ts SSR error-wrapper entry exactly.
    server: { entry: "server" },
  },
  vite: {
    plugins: [enforceLocalClient()],
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
  },
});
