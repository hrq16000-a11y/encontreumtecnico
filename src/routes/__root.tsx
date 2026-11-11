import { useMatches as useImportedMatches } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { FriendlyErrorState } from "../components/friendly-error-state";
import { PageShell } from "../components/page-placeholder";
import { AdSenseLoader } from "../components/adsense-loader";
import { isStandaloneVisualRoute } from "../lib/shared-shell-routing";

// One stable, public, WordPress-independent image for every route's social preview.
const SOCIAL_IMAGE = "https://www.encontreumtecnico.com/social-preview.jpg";

function NotFoundComponent() {
  return <FriendlyErrorState status={404} />;
}

function getFriendlyErrorStatus(error: unknown): 403 | 500 | 503 {
  if (typeof error !== "object" || error === null) return 500;
  const value = error as { status?: unknown; statusCode?: unknown };
  const status = value.status ?? value.statusCode;
  if (status === 401 || status === 403) return 403;
  if (status === 503) return 503;
  return 500;
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <FriendlyErrorState
      status={getFriendlyErrorStatus(error)}
      onRetry={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "O-IQy-UG-3vu25luyD7srfGtD_lU8_tOTZzVbda7t9Q" },
      { name: "google-adsense-account", content: "ca-pub-3762170279587706" },
      { title: "Encontre um Técnico" },
      { name: "description", content: "Encontre e contrate técnicos de tecnologia perto de você." },
      { property: "og:title", content: "Encontre um Técnico" },
      { property: "og:description", content: "Encontre e contrate técnicos de tecnologia perto de você." },
      { property: "og:type", content: "website" },
      // Root metadata applies to all matched routes, including deep links.
      // A public default avoids leaking profile photos or private account data.
      { property: "og:image", content: SOCIAL_IMAGE },
      { property: "og:image:secure_url", content: SOCIAL_IMAGE },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:alt", content: "Técnico de segurança em atendimento — Encontre um Técnico" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: SOCIAL_IMAGE },
      { name: "twitter:image:alt", content: "Encontre um Técnico — profissionais de tecnologia em todo o Brasil" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    importedDocument?: {
      html?: import("react").HTMLAttributes<HTMLHtmlElement> & Record<`data-${string}`, string>;
      body?: import("react").HTMLAttributes<HTMLBodyElement> & Record<`data-${string}`, string>;
    };
  }
}

function RootShell({ children }: { children: ReactNode }) {
  const importedDocument = useImportedMatches({ select: matches => matches.at(-1)?.staticData.importedDocument });
  return (
    <html lang="pt-BR" {...importedDocument?.html}>
      <head>
        <style href="site-import-inline" precedence="imported-inline">{"@layer imported-inline;"}</style>
        <HeadContent />
      </head>
      <body {...importedDocument?.body}>
        <AdSenseLoader />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: state => state.location.pathname });
  // Full-screen friendly 404/403/500 pages own their chrome.
  // Do not nest an extra header, footer or main around error boundaries.
  const hasRouteError = useRouterState({
    select: state => state.matches.some(match => match.status === "notFound" || match.status === "error"),
  });

  return (
    <QueryClientProvider client={queryClient}>
      {isStandaloneVisualRoute(pathname) || hasRouteError ? (
        // LP2 and Home2 intentionally own their themes and navigation.
        <Outlet />
      ) : (
        // Header, auth indicator, footer and the unsent help wizard survive
        // route changes. Each nested PageShell now renders content only.
        <PageShell><Outlet /></PageShell>
      )}
    </QueryClientProvider>
  );
}
