// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));

import { SponsoredPublicSlot } from "./sponsored-public-slot";

const consentKey = "eut-cookie-consent";
const approved = {
  label: "Publicidade", brand_name: "Marca Teste", headline: "Campanha aprovada",
  description: "Anúncio sintético", destination_url: "https://anunciante.example/oferta",
  creative_type: "sponsored_card", slot_key: "home.content_1",
};
const allow = () => localStorage.setItem(consentKey, JSON.stringify({ advertising: true }));
const deny = () => localStorage.setItem(consentKey, JSON.stringify({ advertising: false }));

let signals: AbortSignal[];

beforeEach(() => {
  localStorage.clear();
  signals = [];
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  mock.rpc.mockReset();
  mock.rpc.mockImplementation(() => ({
    abortSignal(signal: AbortSignal) {
      signals.push(signal);
      return Promise.resolve({ data: approved, error: null });
    },
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("SponsoredPublicSlot: consentimento de publicidade", () => {
  it("sem opt-in, não consulta a RPC e mantém o convite editorial", () => {
    render(<SponsoredPublicSlot slotKey="home.content_1" routePath="/" />);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(screen.getByText("Sua marca pode aparecer aqui")).toBeTruthy();
  });

  it("consulta somente após opt-in e preserva a validação de campanha", async () => {
    render(<SponsoredPublicSlot slotKey="home.content_1" routePath="/" />);
    allow();
    await act(async () => {
      window.dispatchEvent(new Event("eut-consent-changed"));
      await Promise.resolve();
    });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith("eut_ads_public_slot", {
      _slot_key: "home.content_1", _route_path: "/",
    });
    expect(screen.getByText("Campanha aprovada")).toBeTruthy();
  });

  it("revogação na mesma aba remove anúncio e aborta solicitação", async () => {
    allow();
    render(<SponsoredPublicSlot slotKey="home.content_1" routePath="/" />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Campanha aprovada")).toBeTruthy();
    deny();
    await act(async () => { window.dispatchEvent(new Event("eut-consent-changed")); });
    expect(signals[0]?.aborted).toBe(true);
    expect(screen.queryByText("Campanha aprovada")).toBeNull();
    expect(screen.getByText("Sua marca pode aparecer aqui")).toBeTruthy();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it("revogação em outra aba invalida a campanha", async () => {
    allow();
    render(<SponsoredPublicSlot slotKey="home.content_1" routePath="/" />);
    await act(async () => { await Promise.resolve(); });
    deny();
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: consentKey, newValue: '{"advertising":false}' }));
    });
    expect(screen.queryByText("Campanha aprovada")).toBeNull();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it("resposta antiga não reaparece após revogação, mesmo com abort ignorado", async () => {
    let complete!: (value: { data: typeof approved; error: null }) => void;
    mock.rpc.mockImplementation(() => ({
      abortSignal(signal: AbortSignal) {
        signals.push(signal);
        return new Promise<{ data: typeof approved; error: null }>((resolve) => { complete = resolve; });
      },
    }));
    allow();
    render(<SponsoredPublicSlot slotKey="home.content_1" routePath="/" />);
    deny();
    await act(async () => { window.dispatchEvent(new Event("eut-consent-changed")); });
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => { complete({ data: approved, error: null }); await Promise.resolve(); });
    expect(screen.queryByText("Campanha aprovada")).toBeNull();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
});
