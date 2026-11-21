// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Municipality } from "@/hooks/use-municipalities";
import {
  confirmedHomeCity, HomeMunicipalitySearch, homeLocationFilters, parseHomeCityId,
} from "./home-municipality-search";

const municipalities: Municipality[] = [
  { id: 2701506, name: "Campo Grande", uf: "AL", latitude: 0, longitude: 0 },
  { id: 5002704, name: "Campo Grande", uf: "MS", latitude: 0, longitude: 0 },
  { id: 4106902, name: "Curitiba", uf: "PR", latitude: 0, longitude: 0 },
  { id: 4125506, name: "São José dos Pinhais", uf: "PR", latitude: 0, longitude: 0 },
];
afterEach(cleanup);

describe("Home — escolha de município e UF", () => {
  it("não mistura Campo Grande/AL com Campo Grande/MS", () => {
    expect(confirmedHomeCity("AL", "Campo Grande", 2701506, municipalities)?.id).toBe(2701506);
    expect(confirmedHomeCity("MS", "Campo Grande", 2701506, municipalities)).toBeNull();
    expect(confirmedHomeCity("MS", "Campo Grande", 5002704, municipalities)?.id).toBe(5002704);
    expect(confirmedHomeCity("MS", "Campo Grande", null, municipalities)).toBeNull();
    expect(homeLocationFilters("MS", "Campo Grande", 2701506, municipalities, "Centro")).toBeNull();
  });

  it("exige correspondência oficial exata e não confia em sugestões nem rascunho legado", () => {
    expect(confirmedHomeCity("PR", "Curitiba", null, municipalities)).toBeNull();
    expect(confirmedHomeCity("PR", "Curitiba", 4106902, [])).toBeNull();
    expect(confirmedHomeCity("PR", "São José dos Pinhais", 4106902, municipalities)).toBeNull();
    expect(confirmedHomeCity("PR", "curitíba", 4106902, municipalities)?.name).toBe("Curitiba");
    expect(parseHomeCityId("4106902")).toBe(4106902);
    expect(parseHomeCityId("abc")).toBeNull();
    expect(parseHomeCityId("1e6")).toBeNull();
    expect(parseHomeCityId("")).toBeNull();
  });

  it("preserva cidade, UF, bairro e prioridade apenas depois da validação", () => {
    expect(homeLocationFilters("PR", "Curitiba", 4106902, municipalities, "Centro"))
      .toEqual({ cidade: "Curitiba", uf: "PR", bairro: "Centro", prioridade: "regiao" });
    expect(homeLocationFilters("PR", "Curitiba", null, municipalities, "Centro"))
      .toBeNull();
    expect(homeLocationFilters("PR", "", null, municipalities, "Centro"))
      .toEqual({ cidade: "", uf: "PR", bairro: "", prioridade: "regiao" });
    expect(homeLocationFilters("", "", null, municipalities, "Centro"))
      .toEqual({ cidade: "", uf: "", bairro: "", prioridade: "" });
    expect(homeLocationFilters("XX", "", null, municipalities, "Centro"))
      .toEqual({ cidade: "", uf: "", bairro: "", prioridade: "" });
  });

  it("permite filtrar pelo nome e confirmar pelo ID oficial, sem escolher silenciosamente", () => {
    const onSelectCity = vi.fn();
    const onUfChange = vi.fn();
    const onCityTextChange = vi.fn();
    const cities = municipalities.filter(city => city.uf === "MS");
    render(<HomeMunicipalitySearch uf="MS" cityName="Campo"
      selectedId={null} cities={cities} loading={false} error={false}
      retry={vi.fn()} showValidationError={false}
      onUfChange={onUfChange} onCityTextChange={onCityTextChange}
      onSelectCity={onSelectCity} />);
    const uf = screen.getByRole("combobox", { name: "UF" }) as HTMLSelectElement;
    expect(uf.value).toBe("MS");
    const chosen = screen.getByRole("combobox", { name: /Confirmar município/ }) as HTMLSelectElement;
    expect(chosen.value).toBe("");
    expect(Array.from(chosen.options).map(o => o.textContent)).toContain("Campo Grande/MS");
    expect(Array.from(chosen.options).map(o => o.textContent)).not.toContain("Campo Grande/AL");
    fireEvent.change(chosen, { target: { value: "5002704" } });
    expect(onSelectCity).toHaveBeenCalledWith(expect.objectContaining({
      id: 5002704, name: "Campo Grande", uf: "MS",
    }));
    fireEvent.change(uf, { target: { value: "AL" } });
    expect(onUfChange).toHaveBeenCalledWith("AL");
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar município" }),
      { target: { value: "Grande" } });
    expect(onCityTextChange).toHaveBeenCalledWith("Grande");
  });

  it("mostra falha de catálogo e não aceita seleção ambígua", () => {
    const { rerender } = render(<HomeMunicipalitySearch uf="PR" cityName="Curitiba"
      selectedId={null} cities={[]} loading={false} error={true} retry={vi.fn()}
      showValidationError={true} onUfChange={vi.fn()} onCityTextChange={vi.fn()}
      onSelectCity={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível");
    expect((screen.getByRole("combobox", { name: /Confirmar município/ }) as HTMLSelectElement).disabled).toBe(true);
    rerender(<HomeMunicipalitySearch uf="PR" cityName="Curitiba"
      selectedId={null} cities={municipalities} loading={false} error={false}
      retry={vi.fn()} showValidationError={true}
      onUfChange={vi.fn()} onCityTextChange={vi.fn()} onSelectCity={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("Confirme o município");
  });
});
