// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { from, rpc, eq, range } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), eq: vi.fn(), range: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from, rpc } }));
vi.mock("@/hooks/use-active-categories", () => ({ useActiveCategories: () => ({ categories: [] }) }));
vi.mock("@/components/technician-avatar", () => ({ TechnicianAvatar: () => null }));
vi.mock("@/components/admin-technician-comprehensive-draft", () => ({ AdminTechnicianComprehensiveDraft: () => null }));
vi.mock("@/components/technician-operations-editor", () => ({ TechnicianOperationsEditor: () => null }));
import { AdminTechnicianManager } from "./admin-technician-manager";
const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const row = (id: string, display_name: string) => ({
  id, display_name, status: "suspenso", city: null, region: null, specialties: [],
  service_slugs: [], state_uf: null, neighborhood: null, coverage_city_ids: [],
  created_at: "2026-11-28T00:00:00Z", updated_at: "2026-11-28T00:00:00Z",
});
beforeEach(() => {
  const q = { select: () => q, eq, order: () => q, range };
  from.mockReturnValue(q);
  eq.mockReturnValue(q);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("gestão de ficha de portal por UUID exato", () => {
  it("não mistura outro perfil devolvido na consulta e abre o suspenso", async () => {
    range.mockResolvedValue({ data: [row(other,"Outro perfil"),row(id,"Perfil exato")], count: 2, error: null });
    render(<AdminTechnicianManager adminOwnerId="admin-sintetico" selectedTechnicianId={id} />);
    expect(await screen.findByText("Perfil exato")).toBeInTheDocument();
    expect(screen.queryByText("Outro perfil")).toBeNull();
    expect(eq).toHaveBeenCalledWith("id", id);
    expect(eq).not.toHaveBeenCalledWith("status", expect.anything());
    expect(range).toHaveBeenCalledWith(0, 0);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("não oferece editor quando o servidor não devolve o UUID solicitado", async () => {
    range.mockResolvedValue({ data: [row(other,"Outro perfil")], count: 1, error: null });
    render(<AdminTechnicianManager adminOwnerId="admin-sintetico" selectedTechnicianId={id} />);
    expect(await screen.findByText(/Técnico não encontrado/)).toBeInTheDocument();
    expect(screen.queryByText("Outro perfil")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
