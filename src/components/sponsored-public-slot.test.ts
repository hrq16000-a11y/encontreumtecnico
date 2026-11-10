import { describe, expect, it } from "vitest";
import { asApprovedSponsoredCard } from "./sponsored-public-slot";

const approved = {
  label: "Publicidade",
  brand_name: "Parceiro Comercial",
  headline: "Campanha aprovada",
  description: "Anúncio contextual, sem rastreamento",
  destination_url: "https://anunciante.example/oferta",
  creative_type: "sponsored_card",
  slot_key: "home.content_1",
};

describe("projeção segura de anúncios patrocinados", () => {
  it("aceita somente dados textuais revisados do slot solicitado", () => {
    expect(asApprovedSponsoredCard(approved, "home.content_1")).toEqual(approved);
    expect(asApprovedSponsoredCard(approved, "search.top")).toBeNull();
  });
  it("rejeita URLs inseguras e dados malformados", () => {
    for (const url of [
      "javascript:alert(1)", "http://exemplo.com", "https://exemplo.com\nhttps://outro.com",
      "/entrar", "data:text/html,ads", "https://", "https://dominio.com espaço",
    ]) {
      expect(asApprovedSponsoredCard({ ...approved, destination_url: url }, "home.content_1")).toBeNull();
    }
    expect(asApprovedSponsoredCard({ ...approved, creative_type: "image" }, "home.content_1")).toBeNull();
    expect(asApprovedSponsoredCard({ ...approved, label: "Parceiro verificado" }, "home.content_1")).toBeNull();
    expect(asApprovedSponsoredCard({ ...approved, brand_name: " " }, "home.content_1")).toBeNull();
    expect(asApprovedSponsoredCard({ ...approved, headline: "X".repeat(151) }, "home.content_1")).toBeNull();
  });
  it("a projeção para a UI omite quaisquer chaves privadas não esperadas", () => {
    const payload = {
      ...approved,
      contact_email: "privado@exemplo.com",
      contact_phone_e164: "+5541999999999",
      price_cents: 10000,
      media_storage_key: "ads/segredo.png",
    };
    expect(asApprovedSponsoredCard(payload,"home.content_1")).toEqual(approved);
  });
});
