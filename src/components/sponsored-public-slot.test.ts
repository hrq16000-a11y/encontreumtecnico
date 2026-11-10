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
  it("aceita imagens somente com caminho público aprovado e alt seguro", () => {
    const image = {
      ...approved,
      creative_type: "image",
      public_media_key: "approved/12345678-1234-1234-1234-123456789abc/abcdefab-1234-1234-1234-abcdefabcdef.webp",
      image_alt: "Câmera de segurança instalada na fachada",
    };
    expect(asApprovedSponsoredCard(image, "home.content_1")).toEqual(image);
    for (const key of [
      "ads/private.webp",
      "../private.webp",
      "approved/invalid/asset.webp",
      "https://attacker.example/photo.webp",
    ]) {
      expect(asApprovedSponsoredCard({ ...image, public_media_key: key }, "home.content_1")).toBeNull();
    }
    expect(asApprovedSponsoredCard({ ...image, image_alt: "x" }, "home.content_1")).toBeNull();
    expect(asApprovedSponsoredCard({ ...image, image_alt: "x".repeat(241) }, "home.content_1")).toBeNull();
    expect(asApprovedSponsoredCard({ ...image, creative_type: "video" }, "home.content_1")).toBeNull();
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
