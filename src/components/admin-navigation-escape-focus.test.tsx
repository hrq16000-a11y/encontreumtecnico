// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  const FakeLink = React.forwardRef<HTMLAnchorElement, {
    to?: string;
    params?: object;
    activeOptions?: object;
    children?: React.ReactNode;
    [key: string]: unknown;
  }>(function FakeLink({ to, params: _params, activeOptions: _activeOptions, ...props }, ref) {
    return <a {...props} ref={ref} href={String(to ?? "#")} />;
  });
  return { Link: FakeLink, createLink: () => FakeLink };
});

vi.mock("@/components/admin-global-search", () => ({
  AdminGlobalSearch: () => <button type="button">Busca global</button>,
}));

import { AdminNavigation } from "./admin-navigation";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe("menu administrativo móvel: retorno de foco", () => {
  it("fecha com Escape e devolve foco ao acionador quando o filtro estava focado", () => {
    render(<AdminNavigation active="tecnicos" />);
    const toggle = screen.getByRole("button", { name: /Menu administrativo/ });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    const filter = screen.getByRole("searchbox", { name: "Filtrar módulos do menu" });
    filter.focus();
    expect(document.activeElement).toBe(filter);
    fireEvent.keyDown(filter, { key: "Escape", bubbles: true });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  it("não interfere em Escape fora do menu, permitindo que diálogos próprios o tratem", () => {
    render(<AdminNavigation active="tecnicos" />);
    const toggle = screen.getByRole("button", { name: /Menu administrativo/ });
    fireEvent.click(toggle);
    const outside = screen.getByRole("button", { name: "Busca global" });
    outside.focus();
    fireEvent.keyDown(outside, { key: "Escape", bubbles: true });

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(outside);
  });
});
