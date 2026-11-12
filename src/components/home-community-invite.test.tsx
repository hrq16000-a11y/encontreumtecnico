// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode; [key: string]: unknown }) => (
    <a href={to} onClick={props["onClick"] as (() => void) | undefined}>{children}</a>
  ),
}));

import { COMMUNITY_INVITE_URL, HomeCommunityInvite } from "./home-community-invite";

describe("convite factual para comunidade", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(min-width: 1024px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it("mantém CTA visível na Home com convite correto e cadastro separado", () => {
    render(<HomeCommunityInvite />);
    const invitation = screen.getByRole("region", { name: /Você não precisa trabalhar isolado/i });
    expect(invitation.querySelectorAll('a[href="' + COMMUNITY_INVITE_URL + '"]')).toHaveLength(1);
    const community = invitation.querySelector('a[href="' + COMMUNITY_INVITE_URL + '"]');
    expect(community?.getAttribute("rel")).toContain("noopener");
    expect(community?.getAttribute("target")).toBe("_blank");
    expect(invitation.querySelector('a[href="/cadastro"]')).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: /convite para profissionais/i })).toBeNull();
  });

  it("oferece um popup discreto após atraso no desktop e permite fechar", () => {
    render(<HomeCommunityInvite />);
    act(() => { vi.advanceTimersByTime(11000); });
    const popup = screen.getByRole("complementary", { name: /convite para profissionais/i });
    expect(popup).toBeTruthy();
    expect(popup.querySelector('a[href="' + COMMUNITY_INVITE_URL + '"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dispensar convite da comunidade" }));
    expect(screen.queryByRole("complementary", { name: /convite para profissionais/i })).toBeNull();
    expect(sessionStorage.getItem("eut-community-invite-home-v1")).toBe("1");
  });

  it("não interrompe quem estiver digitando na busca da Home", () => {
    render(<><input aria-label="Cidade da busca" /><HomeCommunityInvite /></>);
    screen.getByRole("textbox", { name: "Cidade da busca" }).focus();
    act(() => { vi.advanceTimersByTime(11000); });
    expect(screen.queryByRole("complementary", { name: /convite para profissionais/i })).toBeNull();
  });

  it("não repete o popup na mesma sessão", () => {
    sessionStorage.setItem("eut-community-invite-home-v1", "1");
    render(<HomeCommunityInvite />);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(screen.queryByRole("complementary", { name: /convite para profissionais/i })).toBeNull();
  });
});
