import { describe, expect, it } from "vitest";
import { FRIENDLY_ERROR_COPY } from "./friendly-error-copy";
import { renderErrorPage } from "./error-page";

describe("friendly error pages", () => {
  it("provides Portuguese copy and recovery actions for every supported status", () => {
    for (const status of [403, 404, 500, 503] as const) {
      const copy = FRIENDLY_ERROR_COPY[status];
      expect(copy.title.length).toBeGreaterThan(10);
      expect(copy.description.length).toBeGreaterThan(20);
      expect(copy.actionLabel.length).toBeGreaterThan(5);
    }
    expect(FRIENDLY_ERROR_COPY[404].actionHref).toBe("/tecnicos");
    expect(FRIENDLY_ERROR_COPY[403].actionHref).toBe("/entrar");
  });

  it.each([500, 503] as const)("renders a standalone %s fallback without JavaScript", (status) => {
    const markup = renderErrorPage(status);
    expect(markup).toContain('lang="pt-BR"');
    expect(markup).toContain(`<title>${status} ·`);
    expect(markup).toContain(FRIENDLY_ERROR_COPY[status].title);
    expect(markup).toContain('name="robots" content="noindex,nofollow"');
    expect(markup).toContain('href=""');
    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/contato"');
    expect(markup).not.toContain("<script");
    expect(markup).not.toContain("onclick=");
    expect(markup).not.toContain("Page not found");
  });

  it("defaults to a 500 fallback", () => {
    expect(renderErrorPage()).toContain("500 · Falha temporária");
  });
});
