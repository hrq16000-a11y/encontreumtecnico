import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const social = "https://www.encontreumtecnico.com/social-preview.jpg";

describe("imagem social global — Encontre um Técnico", () => {
  it("usa uma imagem JPG pública própria, estável e não dependente do WordPress", () => {
    const imagePath = "public/social-preview.jpg";
    expect(statSync(imagePath).size).toBeGreaterThan(50_000);
    const bytes = readFileSync(imagePath);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes.at(-2)).toBe(0xff);
    expect(bytes.at(-1)).toBe(0xd9);
  });
  it("expõe a imagem social para todas as rotas por herança do head raiz", () => {
    const root = read("src/routes/__root.tsx");
    expect(root).toContain("const SOCIAL_IMAGE = " + JSON.stringify(social));
    expect(root).toContain('property: "og:image", content: SOCIAL_IMAGE');
    expect(root).toContain('property: "og:image:secure_url", content: SOCIAL_IMAGE');
    expect(root).toContain('property: "og:image:type", content: "image/jpeg"');
    expect(root).toContain('name: "twitter:image", content: SOCIAL_IMAGE');
    expect(root).toContain('name: "twitter:card", content: "summary_large_image"');
    expect(root).toContain("<HeadContent />");
    expect(root).not.toContain('name: "robots", content: "noindex, nofollow"');
  });
  it("não usa foto histórica pessoal nem expõe contato em thumbnail", () => {
    const root = read("src/routes/__root.tsx");
    const imageMeta = root.split("// Root metadata applies")[1]?.split("links: [")[0] ?? "";
    expect(imageMeta).not.toMatch(/contact_phone|contact_email|legacy_avatar|wp_post_id|service_role/);
    expect(read("src/routes/tecnico.$slug.tsx")).toContain('noindex, nofollow');
    expect(read("src/routes/cliente.$slug.tsx")).toContain('noindex, nofollow');
    expect(read("src/routes/area-cliente.tsx")).toContain('noindex, nofollow');
  });
  it("verifica a URL pública e o HTML SSR em smoke sem acesso a segredos", () => {
    const smoke = read("scripts/eut-public-smoke.mjs");
    expect(smoke).toContain('["/social-preview.jpg", 200]');
    expect(smoke).toContain("hasSocialMetadata(await response.text())");
    expect(smoke).toContain("allowed.has(next.origin)");
    expect(smoke).toContain('"https://www.encontreumtecnico.com"');
  });
});
