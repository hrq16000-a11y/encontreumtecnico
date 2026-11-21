import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Municipality } from "@/hooks/use-municipalities";
import { TechnicianCoverageEditor } from "./technician-coverage-editor";

const readCities = vi.hoisted(() => vi.fn());
const writeCoverage = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ in: readCities }) }),
    rpc: writeCoverage,
  },
}));
vi.mock("@/hooks/use-municipalities", () => ({
  useMunicipalities: () => ({ cities: [], loading: false, error: null, retry: vi.fn() }),
  normalizedCityText: (name: string) => name.toLocaleLowerCase("pt-BR"),
}));

const base = { id: 4106902, name: "Curitiba", uf: "PR" } as Municipality;
const colombo = { id: 4105805, name: "Colombo", uf: "PR" } as Municipality;

function editor() {
  return <TechnicianCoverageEditor userId="owner-a" baseMunicipality={base}
    savedCityIds={[base.id, colombo.id]} savedRadius={20} />;
}

beforeEach(() => { readCities.mockReset(); writeCoverage.mockReset(); });
afterEach(() => cleanup());

describe("restauração de cobertura antes de editar", () => {
  it("impede gravação enquanto as cidades salvas ainda estão sendo recuperadas", async () => {
    let resolveRead!: (result: { data: Municipality[]; error: null }) => void;
    readCities.mockImplementation(() => new Promise((resolve) => { resolveRead = resolve; }));
    render(editor());
    const save = screen.getByRole("button", { name: "Salvar raio e cidades atendidas" });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(writeCoverage).not.toHaveBeenCalled();

    await act(async () => { resolveRead({ data: [colombo], error: null }); });
    expect(save).toBeEnabled();
    expect(screen.getByText("Colombo/PR")).toBeInTheDocument();
  });

  it("mantém bloqueada a gravação se o catálogo retorna apenas parte da cobertura", async () => {
    readCities.mockResolvedValue({ data: [], error: null });
    render(editor());
    expect(await screen.findByText(/Não conseguimos recuperar todas as cidades anteriores/)).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Salvar raio e cidades atendidas" });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(writeCoverage).not.toHaveBeenCalled();
  });
});
