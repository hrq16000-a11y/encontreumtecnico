import { createFileRoute } from "@tanstack/react-router";

// Prepared only. Production and missing test credentials always fail closed.
export const Route = createFileRoute("/api/presence/leases")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { postPresenceLease } = await import("@/lib/pr344-http-presence-handlers.server");
        try {
          const { loadPr344IsolatedServices } = await import("@/lib/pr344-http-presence-local.server");
          return await postPresenceLease(request, await loadPr344IsolatedServices());
        } catch { return postPresenceLease(request, null); }
      },
    },
  },
});
