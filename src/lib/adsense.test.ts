import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { allowsAdSenseAdvertising, isEligibleAdSenseRoute } from "@/components/adsense-loader";

describe("Google AdSense: verificação e privacidade", () => {
  it("usa a mesma conta no meta, ads.txt e loader", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    const ads = readFileSync("public/ads.txt", "utf8");
    const loader = readFileSync("src/components/adsense-loader.tsx", "utf8");
    const shell = readFileSync("src/components/page-placeholder.tsx", "utf8");
    expect(root).toContain('name: "google-adsense-account", content: "ca-pub-3762170279587706"');
    expect(ads).toBe("google.com, pub-3762170279587706, DIRECT, f08c47fec0942fa0\\n".replace("\\n", "\n"));
    expect(loader).toContain("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=");
    expect(loader).toContain('import.meta.env["VITE_EUT_ADSENSE_SERVING"] !== "false"');
    expect(loader).toContain('import.meta.env["VITE_EUT_ADSENSE_DISPLAY_9606076941"] === "true"');
    expect(loader).toContain('ADSENSE_DISPLAY_SLOT = "9606076941"');
    expect(shell).toContain("<AdSenseDisplaySlot />");
    expect(root).toContain("<AdSenseLoader />");
    const home = readFileSync("src/routes/index.tsx", "utf8");
    const unit = readFileSync("src/components/adsense-public-unit.tsx", "utf8");
    expect(home).toContain("<AdSensePublicUnit />");
    expect(unit).toContain('const CLIENT = "ca-pub-3762170279587706"');
    expect(unit).toContain('const SLOT = "5328066374"');
    expect(unit).toContain('data-ad-format="autorelaxed"');
    expect(unit).toContain("hasAdvertisingConsent");

  });
  it("não carrega anúncios no admin, login, cadastro, pagamento nem telas pessoais", () => {
    for (const route of ["/", "/tecnicos", "/servicos", "/faq", "/galeria"]) {
      expect(isEligibleAdSenseRoute(route)).toBe(true);
    }
    for (const route of ["/admin", "/admin/patrocinadores", "/entrar", "/cadastro", "/area-tecnico", "/area-cliente", "/acesso-contato/123", "/lp2", "/home2", "/tecnicos/123", "/contato", "/nao-existe"]) {
      expect(isEligibleAdSenseRoute(route)).toBe(false);
    }
  });
  it("exige publicidade explicitamente aceita, sem herdar consentimentos antigos", () => {
    expect(allowsAdSenseAdvertising(null)).toBe(false);
    expect(allowsAdSenseAdvertising({ necessary: true, functional: true, analytics: true })).toBe(false);
    expect(allowsAdSenseAdvertising({ advertising: false })).toBe(false);
    expect(allowsAdSenseAdvertising({ advertising: "true" })).toBe(false);
    expect(allowsAdSenseAdvertising({ advertising: true })).toBe(true);
  });
  it("separa publicidade Google dos patrocinadores do próprio portal", () => {
    const existingAds = readFileSync("src/components/sponsored-public-slot.tsx", "utf8");
    expect(existingAds).toContain('db.rpc("eut_ads_public_slot"');
    expect(existingAds).not.toContain("adsbygoogle");
  });
});
