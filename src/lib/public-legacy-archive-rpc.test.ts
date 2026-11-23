import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { readPublicLegacyArchivePage } from "./public-legacy-archive-rpc";

const valid = {
  wp_post_id: 31,
  display_name: "Ana Costa",
  sector_tags: ["Informática", "Atendimento 3333-4444"],
  country_label: "Brasil",
  validation_status: "em_validacao",
};
beforeEach(() => rpc.mockReset());
describe("sanitized public legacy archive RPC (synthetic)", () => {
  it("requests bounded pages and removes contact-like category tags", async () => {
    rpc.mockResolvedValue({ data: { profiles: [valid], count: 31 }, error: null });
    const page = await readPublicLegacyArchivePage(4, 0);
    expect(rpc).toHaveBeenCalledWith("eut_public_legacy_archive_page", { _limit: 4, _offset: 0 });
    expect(page).toEqual({ profiles: [{ ...valid, sector_tags: ["Informática"] }], count: 31 });
  });
  it("guards contact-like names even for adversarial synthetic responses", async () => {
    rpc.mockResolvedValue({ data: { profiles: [{ ...valid, display_name: "alexa@example.test" }], count: 1 }, error: null });
    const page = await readPublicLegacyArchivePage(24, 24);
    expect(page.profiles[0]?.display_name).toBe("Técnico");
    expect(JSON.stringify(page)).not.toContain("alexa@example.test");
  });
  it("fails closed for API errors and unexpected JSON fields", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "private error" } });
    await expect(readPublicLegacyArchivePage(4, 0)).rejects.toThrow("Não foi possível consultar");
    rpc.mockResolvedValueOnce({ data: { profiles: [{ ...valid, phone: "private" }], count: 1 }, error: null });
    await expect(readPublicLegacyArchivePage(4, 0)).rejects.toThrow("Resposta inválida");
    rpc.mockResolvedValueOnce({ data: { profiles: [], count: "31" }, error: null });
    await expect(readPublicLegacyArchivePage(4, 0)).rejects.toThrow("Resposta inválida");
  });
  it("rejects invalid offsets without calling the database", async () => {
    await expect(readPublicLegacyArchivePage(24, -1)).rejects.toThrow("Parâmetros inválidos");
    await expect(readPublicLegacyArchivePage(24, 24001)).rejects.toThrow("Parâmetros inválidos");
    expect(rpc).not.toHaveBeenCalled();
  });
});
