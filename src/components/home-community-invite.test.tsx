// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const ads = vi.hoisted(() => ({
  card: null as Record<string, unknown> | null,
  rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: ads.rpc.mockImplementation(() => Promise.resolve({ data: ads.card, error: null })) },
}));

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
    localStorage.clear();
    ads.card = null;
    ads.rpc.mockClear();
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
    localStorage.clear();
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

  it("oferece convite compacto no celular após atraso, sem bloquear o conteúdo", () => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    render(<HomeCommunityInvite />);
    act(() => { vi.advanceTimersByTime(11000); });
    const popup = screen.getByRole("complementary", { name: /convite para profissionais/i });
    expect(popup.className).not.toContain("hidden");
    expect(popup.className).toContain("bottom-24");
    fireEvent.click(screen.getByRole("button", { name: "Dispensar convite da comunidade" }));
    expect(popup.isConnected).toBe(false);
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

  it("usa somente campanha contratada e publicada pelo RPC, com consentimento de publicidade", async () => {
    localStorage.setItem("eut-cookie-consent", '{"advertising":true}');
    ads.card = {
      label: "Publicidade", brand_name: "Marca Real", headline: "Oferta vigente",
      description: "Campanha com autorização", destination_url: "https://patrocinador.example/oferta",
      creative_type: "sponsored_card", slot_key: "home.content_1",
    };
    render(<HomeCommunityInvite />);
    await act(async () => { await Promise.resolve(); });
    act(() => { vi.advanceTimersByTime(11000); });
    const popup = screen.getByRole("complementary", { name: /campanha publicitária aprovada/i });
    expect(popup.textContent).toContain("Oferta vigente");
    expect(popup.querySelector('a[href="https://patrocinador.example/oferta"]')?.getAttribute("rel")).toContain("sponsored");
    expect(ads.rpc).toHaveBeenCalledWith("eut_ads_public_slot", { _slot_key: "home.content_1", _route_path: "/" });
  });

  it("não consulta patrocinadores sem a escolha explícita de publicidade", () => {
    localStorage.setItem("eut-cookie-consent", '{"analytics":true,"advertising":false}');
    render(<HomeCommunityInvite />);
    act(() => { vi.advanceTimersByTime(11000); });
    expect(ads.rpc).not.toHaveBeenCalled();
    expect(screen.getByRole("complementary", { name: /convite para profissionais/i })).toBeTruthy();
  });
});
