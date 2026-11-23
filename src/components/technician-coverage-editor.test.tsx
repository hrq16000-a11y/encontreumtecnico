import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Municipality } from "@/hooks/use-municipalities";
import { TechnicianCoverageEditor } from "./technician-coverage-editor";

const readCities = vi.hoisted(() => vi.fn());
const writeCoverage = vi.hoisted(() => vi.fn());
const readPersisted = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => table === "technicians"
      ? { select: () => ({ eq: () => ({ maybeSingle: readPersisted }) }) }
      : { select: () => ({ in: readCities }) },
    rpc: writeCoverage,
  },
}));
vi.mock("@/hooks/use-municipalities", () => ({
  useMunicipalities: () => ({ cities: [], loading: false, error: null, retry: vi.fn() }),
  normalizedCityText: (name: string) => name.toLocaleLowerCase("pt-BR"),
}));

const base = { id: 4106902, name: "Curitiba", uf: "PR" } as Municipality;
const colombo = { id: 4105805, name: "Colombo", uf: "PR" } as Municipality;
const sjp = { id: 4125506, name: "São José dos Pinhais", uf: "PR" } as Municipality;

function editor() {
  return <TechnicianCoverageEditor userId="owner-a" baseMunicipality={base}
    savedCityIds={[base.id, colombo.id]} savedRadius={20} />;
}

beforeEach(() => { readCities.mockReset(); writeCoverage.mockReset(); readPersisted.mockReset(); });
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

describe("reconciliação de versões sem perda de edição", () => {
  it("rejeita o mesmo número de cidades quando os IDs retornados são diferentes", async () => {
    readCities.mockResolvedValue({ data: [sjp], error: null });
    render(editor());
    expect(await screen.findByText(/Não conseguimos recuperar todas as cidades anteriores/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar raio e cidades atendidas" })).toBeDisabled();
    expect(writeCoverage).not.toHaveBeenCalled();
  });

  it("recupera novas cidades do mesmo titular quando as propriedades mudam sem edição local", async () => {
    let resolveRead!: (result: { data: Municipality[]; error: null }) => void;
    readCities.mockImplementation(() => new Promise((resolve) => { resolveRead = resolve; }));
    const renderEditor = (ids: number[], radius: number) =>
      <TechnicianCoverageEditor userId="owner-a" baseMunicipality={base}
        savedCityIds={ids} savedRadius={radius} />;
    const view = render(renderEditor([base.id], 20));
    const save = screen.getByRole("button", { name: "Salvar raio e cidades atendidas" });
    await waitFor(() => expect(save).toBeEnabled());
    view.rerender(renderEditor([base.id, colombo.id], 30));
    expect(save).toBeDisabled();
    await act(async () => { resolveRead({ data: [colombo], error: null }); });
    expect(save).toBeEnabled();
    expect(screen.getByText("Colombo/PR")).toBeInTheDocument();
    expect(screen.getByLabelText("Raio de atendimento declarado")).toHaveValue("30");
  });

  it("preserva edições locais quando chega uma versão externa e só recarrega após decisão explícita", async () => {
    readCities.mockResolvedValue({ data: [colombo], error: null });
    const renderEditor = (radius: number) =>
      <TechnicianCoverageEditor userId="owner-a" baseMunicipality={base}
        savedCityIds={[base.id, colombo.id]} savedRadius={radius} />;
    const view = render(renderEditor(20));
    await screen.findByText("Colombo/PR");
    const field = screen.getByLabelText("Raio de atendimento declarado");
    fireEvent.change(field, { target: { value: "30" } });
    view.rerender(renderEditor(50));
    expect(screen.getByText(/Suas alterações foram preservadas/)).toBeInTheDocument();
    expect(field).toHaveValue("30");
    expect(screen.getByText("Colombo/PR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar raio e cidades atendidas" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Descartar alterações locais e recarregar cobertura salva/ }));
    await waitFor(() => expect(field).toHaveValue("50"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar raio e cidades atendidas" })).toBeEnabled());
    expect(writeCoverage).not.toHaveBeenCalled();
  });

  it("ignora a resposta da consulta anterior se os IDs salvos mudarem enquanto ela estiver pendente", async () => {
    const resolvers: Array<(result: { data: Municipality[]; error: null }) => void> = [];
    readCities.mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve); }));
    const renderEditor = (ids: number[]) =>
      <TechnicianCoverageEditor userId="owner-a" baseMunicipality={base}
        savedCityIds={ids} savedRadius={20} />;
    const view = render(renderEditor([base.id, colombo.id]));
    view.rerender(renderEditor([base.id, sjp.id]));
    expect(resolvers).toHaveLength(2);
    await act(async () => { resolvers[0]!({ data: [colombo], error: null }); });
    expect(screen.getByRole("button", { name: "Salvar raio e cidades atendidas" })).toBeDisabled();
    expect(screen.queryByText("Colombo/PR")).not.toBeInTheDocument();
    await act(async () => { resolvers[1]!({ data: [sjp], error: null }); });
    expect(screen.getByText("São José dos Pinhais/PR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar raio e cidades atendidas" })).toBeEnabled();
  });

  it("não substitui a cobertura após a confirmação de uma gravação do próprio editor", async () => {
    readCities.mockResolvedValue({ data: [colombo], error: null });
    writeCoverage.mockResolvedValue({ data: { state: "salvo" }, error: null });
    readPersisted.mockResolvedValue({ data: { coverage_city_ids: [base.id, colombo.id], service_radius_km: 30 }, error: null });
    const onSaved = vi.fn();
    const renderEditor = (radius: number) =>
      <TechnicianCoverageEditor userId="owner-a" baseMunicipality={base}
        savedCityIds={[base.id, colombo.id]} savedRadius={radius} onSaved={onSaved} />;
    const view = render(renderEditor(20));
    await screen.findByText("Colombo/PR");
    fireEvent.change(screen.getByLabelText("Raio de atendimento declarado"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar raio e cidades atendidas" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith([base.id, colombo.id], 30));
    view.rerender(renderEditor(30));
    expect(screen.getByLabelText("Raio de atendimento declarado")).toHaveValue("30");
    expect(screen.getByText("Colombo/PR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar raio e cidades atendidas" })).toBeEnabled();
  });

  it("reconcilia a cidade-base quando ela muda, sem perder os outros municípios", async () => {
    readCities.mockResolvedValueOnce({ data: [colombo], error: null })
      .mockResolvedValueOnce({ data: [base], error: null });
    const renderEditor = (baseCity: Municipality) =>
      <TechnicianCoverageEditor userId="owner-a" baseMunicipality={baseCity}
        savedCityIds={[base.id, colombo.id]} savedRadius={20} />;
    const view = render(renderEditor(base));
    await screen.findByText("Colombo/PR");
    view.rerender(renderEditor(colombo));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar raio e cidades atendidas" })).toBeEnabled());
    expect(screen.getByText("Curitiba/PR")).toBeInTheDocument();
    expect(screen.getByText(/Colombo\/PR · base/)).toBeInTheDocument();
  });
});

describe("gravação com conferência inconclusiva", () => {
  it("impede reenviar a cobertura quando a RPC salva mas a releitura não confirma todas as cidades", async () => {
    readCities.mockResolvedValue({ data: [colombo], error: null });
    writeCoverage.mockResolvedValue({ data: { state: "salvo" }, error: null });
    readPersisted.mockResolvedValue({
      data: { coverage_city_ids: [base.id], service_radius_km: 20 },
      error: null,
    });
    render(editor());
    await screen.findByText("Colombo/PR");

    const save = screen.getByRole("button", { name: "Salvar raio e cidades atendidas" });
    fireEvent.click(save);
    expect(await screen.findByText(/não confirmou todas as cidades e o raio gravados/)).toBeInTheDocument();
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(writeCoverage).toHaveBeenCalledTimes(1);
  });
});
