// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode, ReactElement } from "react";
import { SERVICE_CATEGORIES, getEnrichedServiceCategory } from "@/lib/service-catalog";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  Link: ({ to, params, search, children, ...props }: {
    to: string; params?: { categoria?: string };
    search?: Record<string, string>; children: ReactNode; [key: string]: unknown;
  }) => {
    const path = params?.categoria ? to.replace("$categoria", params.categoria) : to;
    const href = path + (search ? "?" + new URLSearchParams(search).toString() : "");
    return <a href={href} {...props}>{children}</a>;
  },
}));
vi.mock("@/components/page-placeholder", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/adsense-public-unit", () => ({
  AdSensePublicUnit: () => <aside aria-label="Publicidade" />,
}));
import { Route } from "./guias.index";

const GuidePage = (Route as unknown as { component: () => ReactElement }).component;
afterEach(cleanup);

describe("Guias: caminhos contextuais para técnicos e atendimento", () => {
  it("cada assunto enriquecido oferece busca filtrada por slug canônico existente", () => {
    render(<GuidePage />);
    const enriched = SERVICE_CATEGORIES.filter(category =>
      getEnrichedServiceCategory(category.slug) !== null);
    for (const category of enriched) {
      const link = screen.getByRole("link", {
        name: "Consultar técnicos de " + category.name + " →",
      });
      const url = new URL((link as HTMLAnchorElement).href);
      expect(url.pathname).toBe("/tecnicos");
      expect(url.searchParams.get("especialidade")).toBe(category.slug);
      expect(url.searchParams.get("cidade")).toBe("");
      expect(url.searchParams.get("regiao")).toBe("");
      expect(url.searchParams.has("telefone")).toBe(false);
    }
    expect(screen.getAllByRole("link", { name: /Consultar técnicos de / })).toHaveLength(enriched.length);
  });

  it("quando falta assunto, abre o funil privado sem cadastrar pedido automaticamente", () => {
    const events: unknown[] = [];
    const listener = (event: Event) =>
      events.push((event as CustomEvent<unknown>).detail);
    window.addEventListener("eut-open-free-help", listener);
    try {
      render(<GuidePage />);
      expect(screen.getByRole("button", { name: "Pedir orientação da equipe" }))
        .toHaveProperty("type", "button");
      expect(events).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: "Pedir orientação da equipe" }));
      expect(events).toEqual([{ mode: "managed", service: "Outro serviço", sourcePath: window.location.pathname, placement: "contextual-cta" }]);
      expect(screen.getByText(/Nenhum pedido é enviado sem sua confirmação/)).toBeTruthy();
    } finally {
      window.removeEventListener("eut-open-free-help", listener);
    }
  });
});
