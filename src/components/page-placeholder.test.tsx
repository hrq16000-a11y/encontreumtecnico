// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("./site-header", () => ({ SiteHeader: () => <header data-testid="global-header" /> }));
vi.mock("./site-footer", () => ({ SiteFooter: () => <footer data-testid="global-footer" /> }));
vi.mock("./adsense-loader", () => ({ AdSenseDisplaySlot: () => <section data-testid="display-slot-shell" /> }));
vi.mock("./cookie-notice", () => ({ CookieNotice: () => <div data-testid="global-cookie-notice" /> }));
vi.mock("./back-to-top", () => ({ BackToTop: () => <div data-testid="global-scroll" /> }));
vi.mock("./free-search-help", () => ({ FreeSearchHelp: () => <div data-testid="global-help" /> }));
import { LP2EmbeddedContext, PageShell } from "./page-placeholder";
afterEach(() => cleanup());

describe("persistent shell across operational pages", () => {
  it("keeps a single header, main, footer, and help wizard while only content changes", () => {
    const view = render(<PageShell><PageShell><div>Rota A</div></PageShell></PageShell>);
    const helpNode = screen.getByTestId("global-help");
    expect(screen.getAllByTestId("global-header")).toHaveLength(1);
    expect(screen.getAllByTestId("global-footer")).toHaveLength(1);
    expect(document.querySelectorAll("#conteudo-principal")).toHaveLength(1);
    view.rerender(<PageShell><PageShell><div>Rota B</div></PageShell></PageShell>);
    expect(screen.getByText("Rota B")).toBeTruthy();
    expect(screen.getByTestId("global-help")).toBe(helpNode);
  });
  it("does not wrap the LP2 embedded layout with another header", () => {
    render(<LP2EmbeddedContext.Provider value={true}><PageShell><div>Tema LP2</div></PageShell></LP2EmbeddedContext.Provider>);
    expect(screen.queryByTestId("global-header")).toBeNull();
    expect(screen.getByText("Tema LP2")).toBeTruthy();
  });
});
