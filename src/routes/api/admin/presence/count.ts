import { createFileRoute } from "@tanstack/react-router";

// No role is trusted from the UI; server verifies current persisted admin role.
export const Route = createFileRoute("/api/admin/presence/count")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getAdminPresenceCount } = await import("@/lib/pr344-http-presence-handlers.server");
        try {
          const { loadPr344IsolatedServices } = await import("@/lib/pr344-http-presence-local.server");
          return await getAdminPresenceCount(request, await loadPr344IsolatedServices());
        } catch { return getAdminPresenceCount(request, null); }
      },
    },
  },
});
