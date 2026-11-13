import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  root: here("./"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@/integrations/supabase/client", replacement: here("./mock-supabase.ts") },
      { find: "@tanstack/react-router", replacement: here("./mock-router.tsx") },
      { find: "@", replacement: here("../../src") },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 4187,
    strictPort: true,
    fs: { allow: [here("../../")] },
  },
});
