// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { MunicipalityPicker } from "./municipality-picker";

vi.mock("@/hooks/use-municipalities", () => ({
  normalizedCityText: (value: string) => value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(),
  useMunicipalities: () => ({
    cities: [
      { id: 4125506, name: "São José dos Pinhais", uf: "PR", latitude: 0, longitude: 0 },
      { id: 4106902, name: "Curitiba", uf: "PR", latitude: 0, longitude: 0 },
    ],
    loading: false, error: false, retry: vi.fn(),
  }),
}));

afterEach(() => cleanup());

describe("Busca de município no layout estreito", () => {
  it("permite filtrar e escolher IBGE por toque sem inventar bairro", () => {
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
    const selected = vi.fn();
    render(<MunicipalityPicker uf="PR" selectedId={null} currentCityName="" onSelect={selected} />);
    const search = screen.getByLabelText("Buscar município na lista oficial");
    fireEvent.change(search, { target: { value: "São José" } });
    const choose = screen.getByLabelText("Município selecionado") as HTMLSelectElement;
    const options = Array.from(choose.options).map(x => x.textContent);
    expect(options).toContain("São José dos Pinhais/PR");
    expect(options).not.toContain("Curitiba/PR");
    fireEvent.change(choose, { target: { value: "4125506" } });
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({
      id: 4125506, name: "São José dos Pinhais", uf: "PR",
    }));
  });

  it("mantém município IBGE escolhido visível mesmo quando o filtro não coincide", () => {
    Object.defineProperty(window, "innerWidth", { value: 320, configurable: true });
    render(<MunicipalityPicker uf="PR" selectedId={4125506}
      currentCityName="São José dos Pinhais" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Buscar município na lista oficial"), {
      target: { value: "Curitiba" },
    });
    const select = screen.getByLabelText("Município selecionado") as HTMLSelectElement;
    expect(Array.from(select.options).map(x => x.value)).toContain("4125506");
    expect(select.value).toBe("4125506");
  });
});
