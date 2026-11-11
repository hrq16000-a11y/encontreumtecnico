import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdSensePublicUnit } from "./adsense-public-unit";

const KEY = "eut-cookie-consent";
const ads = window as Window & { adsbygoogle?: Array<Record<string, never>> };

afterEach(() => {
  cleanup();
  localStorage.removeItem(KEY);
  delete ads.adsbygoogle;
});

describe("bloco AdSense público", () => {
  it("não mostra publicidade sem permissão de cookies", () => {
    render(<AdSensePublicUnit />);
    expect(screen.queryByRole("region", { name: "Publicidade Google AdSense" })).toBeNull();
    expect(ads.adsbygoogle).toBeUndefined();
  });

  it("usa exatamente a conta, o slot e o formato fornecidos quando há consentimento", () => {
    localStorage.setItem(KEY, JSON.stringify({ necessary: true, advertising: true }));
    render(<AdSensePublicUnit />);
    const region = screen.getByRole("region", { name: "Publicidade Google AdSense" });
    const element = region.querySelector("ins.adsbygoogle");
    expect(element?.getAttribute("data-ad-client")).toBe("ca-pub-3762170279587706");
    expect(element?.getAttribute("data-ad-slot")).toBe("5328066374");
    expect(element?.getAttribute("data-ad-format")).toBe("autorelaxed");
    expect(ads.adsbygoogle).toHaveLength(1);
  });

  it("retira o bloco se a preferência de publicidade for revogada", () => {
    localStorage.setItem(KEY, JSON.stringify({ advertising: true }));
    render(<AdSensePublicUnit />);
    expect(screen.getByRole("region", { name: "Publicidade Google AdSense" })).toBeTruthy();
    localStorage.setItem(KEY, JSON.stringify({ advertising: false }));
    act(() => window.dispatchEvent(new Event("eut-consent-changed")));
    expect(screen.queryByRole("region", { name: "Publicidade Google AdSense" })).toBeNull();
  });
});
