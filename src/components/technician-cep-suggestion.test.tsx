import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TechnicianCepSuggestion } from "./technician-cep-suggestion";

vi.mock("@/hooks/use-municipalities", () => ({
  useMunicipalities: (uf: string) => ({
    cities: uf === "PR" ? [{ id: 4106902, name: "Curitiba", uf: "PR" }]
      : uf === "SP" ? [{ id: 3550308, name: "São Paulo", uf: "SP" }] : [],
    loading: false, error: null,
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function cepResponse(uf: string, localidade: string, ibge: string, bairro: string) {
  return { ok: true, json: async () => ({ uf, localidade, ibge, bairro }) } as Response;
}
const enterCep = (value: string) =>
  fireEvent.change(screen.getByLabelText("Seu CEP (opcional) — sugerir cidade e bairro"), {
    target: { value },
  });
const consult = () => fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Cadastro por CEP: resultado associado ao campo atual", () => {
  it("descarta sugestão antiga quando CEP é alterado durante a consulta", async () => {
    const old = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => old.promise));
    const onChoose = vi.fn();
    render(<TechnicianCepSuggestion onChoose={onChoose} />);

    enterCep("80010-010");
    consult();
    enterCep("01001-000");
    expect(screen.getByRole("button", { name: "Buscar CEP" })).toBeEnabled();

    await act(async () => { old.resolve(cepResponse("PR", "Curitiba", "4106902", "Centro")); });
    expect(screen.queryByRole("button", { name: /Usar Curitiba/ })).not.toBeInTheDocument();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("mantém apenas a sugestão da consulta nova mesmo se a antiga terminar depois", async () => {
    const old = deferred<Response>();
    const fresh = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => fresh.promise));
    const onChoose = vi.fn();
    render(<TechnicianCepSuggestion onChoose={onChoose} />);

    enterCep("80010-010");
    consult();
    enterCep("01001-000");
    consult();

    await act(async () => { fresh.resolve(cepResponse("SP", "São Paulo", "3550308", "Sé")); });
    expect(screen.getByRole("button", { name: /Usar São Paulo\/SP/ })).toBeEnabled();
    await act(async () => { old.resolve(cepResponse("PR", "Curitiba", "4106902", "Centro")); });
    expect(screen.queryByRole("button", { name: /Usar Curitiba/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Usar São Paulo\/SP/ }));
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3550308, uf: "SP" }), "Sé",
    );
  });
});
