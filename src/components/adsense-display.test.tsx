// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: {
    select: (state: { location: { pathname: string } }) => string;
  }) => select({ location: { pathname: route.pathname } }),
}));

import { AdSenseDisplaySlot, AdSenseLoader, ADSENSE_DISPLAY_SLOT } from "./adsense-loader";

const publisherScript = 'script[data-eut-adsense="true"]';
const publisherUnit = 'ins.adsbygoogle[data-ad-slot="9606076941"]';

function PortalAd() {
  return <><AdSenseLoader /><AdSenseDisplaySlot /></>;
}
function agree() {
  window.localStorage.setItem("eut-cookie-consent", JSON.stringify({
    necessary: true, functional: false, analytics: false, advertising: true,
  }));
  window.dispatchEvent(new Event("eut-consent-changed"));
}

beforeEach(() => {
  route.pathname = "/";
  vi.stubEnv("VITE_EUT_ADSENSE_SERVING", "true");
  vi.stubEnv("VITE_EUT_ADSENSE_DISPLAY_9606076941", "true");
  window.localStorage.clear();
  (window as Window & { adsbygoogle?: Array<Record<string, never>> }).adsbygoogle = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  window.localStorage.clear();
  document.head.querySelectorAll(publisherScript).forEach((node) => node.remove());
  delete (window as Window & { adsbygoogle?: Array<Record<string, never>> }).adsbygoogle;
});

describe("AdSense display unit 9606076941", () => {
  it("does not inject script or HTML before explicit advertising consent", () => {
    render(<PortalAd />);
    expect(document.querySelector(publisherScript)).toBeNull();
    expect(document.querySelector(publisherUnit)).toBeNull();
  });

  it("keeps new display slot disabled without its dedicated flag, while legacy publisher stays on", () => {
    vi.stubEnv("VITE_EUT_ADSENSE_DISPLAY_9606076941", "false");
    agree();
    render(<PortalAd />);
    // The existing AdSense loader is intentionally still allowed to load for
    // the pre-existing home unit. Only the new display slot stays disabled.
    expect(document.querySelector(publisherScript)).not.toBeNull();
    expect(document.querySelector(publisherUnit)).toBeNull();
  });

  it("new slot defaults to OFF even with existing AdSense enabled and consent", () => {
    vi.stubEnv("VITE_EUT_ADSENSE_DISPLAY_9606076941", "");
    agree();
    render(<PortalAd />);
    expect(document.querySelector(publisherUnit)).toBeNull();
  });

  it("renders the exact responsive unit after consent, with one script and push", async () => {
    render(<StrictMode><PortalAd /></StrictMode>);
    agree();
    await waitFor(() => expect(document.querySelector(publisherUnit)).not.toBeNull());
    expect(ADSENSE_DISPLAY_SLOT).toBe("9606076941");
    expect(document.querySelectorAll(publisherScript)).toHaveLength(1);
    expect(document.querySelector(publisherUnit)?.getAttribute("data-ad-client"))
      .toBe("ca-pub-3762170279587706");
    expect(document.querySelector(publisherUnit)?.getAttribute("data-ad-format")).toBe("auto");
    expect(document.querySelector(publisherUnit)?.getAttribute("data-full-width-responsive")).toBe("true");
    expect((window as Window & { adsbygoogle?: object[] }).adsbygoogle).toHaveLength(1);
  });

  it("does not request twice on a rerender and unmounts the ad on private routes", async () => {
    agree();
    const { rerender } = render(<PortalAd />);
    await waitFor(() => expect(document.querySelector(publisherUnit)).not.toBeNull());
    rerender(<PortalAd />);
    expect((window as Window & { adsbygoogle?: object[] }).adsbygoogle).toHaveLength(1);
    route.pathname = "/admin";
    rerender(<PortalAd />);
    await waitFor(() => expect(document.querySelector(publisherUnit)).toBeNull());
    expect(document.querySelector(publisherScript)).toBeNull();
    expect(screen.queryByRole("region", { name: "Publicidade" })).toBeNull();
  });

  it("does not load on admin/login/technician/client even with advertising consent", () => {
    agree();
    route.pathname = "/area-cliente";
    render(<PortalAd />);
    expect(document.querySelector(publisherUnit)).toBeNull();
    expect(document.querySelector(publisherScript)).toBeNull();
  });

  it("removes the slot immediately when advertising consent is withdrawn", async () => {
    agree();
    render(<PortalAd />);
    await waitFor(() => expect(document.querySelector(publisherUnit)).not.toBeNull());
    window.localStorage.setItem("eut-cookie-consent", JSON.stringify({
      necessary: true, functional: true, analytics: true, advertising: false,
    }));
    window.dispatchEvent(new Event("eut-consent-changed"));
    await waitFor(() => expect(document.querySelector(publisherUnit)).toBeNull());
    expect(document.querySelector(publisherScript)).toBeNull();
  });
});
