import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SearchMunicipalityChoice } from "./search-municipality-choice";

const catalog = vi.hoisted(() => ({ error: false, empty: false, retry: vi.fn() }));
vi.mock("@/hooks/use-municipalities", () => ({ useMunicipalities: (uf: string) => ({
  cities: catalog.empty ? [] : [
    { id: uf === "PR" ? 4125506 : 3550308, name: uf === "PR" ? "São José dos Pinhais" : "São Paulo", uf },
    ...Array.from({length: 110}, (_, n) => ({ id: n + 1, name: `Município ${n}`, uf })),
  ], loading: false, error: catalog.error, retry: catalog.retry,
}) }));
afterEach(() => { cleanup(); catalog.error = false; catalog.empty = false; sessionStorage.clear(); vi.clearAllMocks(); });

describe("Município contextual confirmado", () => {
  it("confirma o nome canônico e UF por teclado, sem acentos, num catálogo extenso", () => {
    const change = vi.fn();
    render(<SearchMunicipalityChoice id="city" uf="PR" city="" onChange={change} />);
    const city = screen.getByRole("combobox", {name: "Cidade"});
    fireEvent.change(city, {target: {value: "SAO JOSE"}});
    expect(change).not.toHaveBeenCalled();
    fireEvent.keyDown(city, {key: "ArrowDown"}); fireEvent.keyDown(city, {key: "Enter"});
    expect(change).toHaveBeenCalledExactlyOnceWith("São José dos Pinhais", "PR");
  });
  it("não substitui escolha explícita por texto incompleto ou Escape", () => {
    const change = vi.fn();
    render(<SearchMunicipalityChoice id="city" uf="PR" city="São José dos Pinhais" onChange={change} />);
    const city = screen.getByRole("combobox", {name: "Cidade"});
    fireEvent.change(city, {target: {value: "Municipio"}}); fireEvent.keyDown(city, {key: "Escape"});
    expect(change).not.toHaveBeenCalled();
    expect((city as HTMLInputElement).value).toBe("São José dos Pinhais");
  });
  it("nunca reutiliza município de outra UF após troca de estado", () => {
    const change = vi.fn();
    const {rerender} = render(<SearchMunicipalityChoice id="city" uf="PR" city="São José dos Pinhais" onChange={change} />);
    rerender(<SearchMunicipalityChoice id="city" uf="SP" city="" onChange={change} />);
    const city = screen.getByRole("combobox", {name: "Cidade"});
    fireEvent.change(city, {target: {value: "SAO PAULO"}}); fireEvent.keyDown(city, {key: "Enter"});
    expect(change).toHaveBeenCalledExactlyOnceWith("São Paulo", "SP");
  });
  it.each(["error", "empty"] as const)("permite busca manual quando catálogo está %s", (state) => {
    catalog[state] = true;
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const change = vi.fn();
    render(<SearchMunicipalityChoice id="city" uf="PR" city="" onChange={change} />);
    const city = screen.getByLabelText("Cidade");
    fireEvent.change(city, {target: {value: "Curitiba"}}); fireEvent.blur(city);
    expect(change).toHaveBeenCalledWith("Curitiba", "PR");
  });
  it("não confirma opção inexistente nem escolhe outra automaticamente", () => {
    const change = vi.fn();
    render(<SearchMunicipalityChoice id="city" uf="PR" city="" onChange={change} />);
    const city = screen.getByRole("combobox", {name: "Cidade"});
    fireEvent.change(city, {target: {value: "Cidade inexistente"}}); fireEvent.keyDown(city, {key: "Enter"});
    expect(change).not.toHaveBeenCalled();
  });
});