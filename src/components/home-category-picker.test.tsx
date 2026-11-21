// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { canonicalHomeCategory, HomeCategoryPicker } from "./home-category-picker";

const categories = [
  { slug: "computadores", label: "Computadores e notebooks" },
  { slug: "cftv", label: "Câmeras e segurança eletrônica" },
  { slug: "redes", label: "Redes e conectividade" },
];

afterEach(cleanup);

describe("seletor da Home para pesquisa de técnicos", () => {
  it("reutiliza apenas slugs ativos e ignora texto livre antigo ou desconhecido", () => {
    expect(canonicalHomeCategory("computadores", categories)).toBe("computadores");
    expect(canonicalHomeCategory("cftv", categories)).toBe("cftv");
    expect(canonicalHomeCategory("Informática", categories)).toBe("Todas");
    expect(canonicalHomeCategory("inventado", categories)).toBe("Todas");
    expect(canonicalHomeCategory("computadores", [])).toBe("Todas");
  });

  it("permite escolher uma categoria ativa com controle nativo acessível", () => {
    const onChange = vi.fn();
    render(<HomeCategoryPicker value="" categories={categories}
      loading={false} error={false} onChange={onChange} />);
    const input = screen.getByRole("combobox", { name: "Especialidade" }) as HTMLSelectElement;
    expect(input.value).toBe("Todas");
    expect(screen.getAllByRole("option")).toHaveLength(4);
    fireEvent.change(input, { target: { value: "redes" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("redes");
    expect(screen.getByText(/serviços específicos podem ser refinados/)).toBeTruthy();
  });

  it("não envia categoria não validada e orienta busca por município em falha do catálogo", () => {
    const onChange = vi.fn();
    const { rerender } = render(<HomeCategoryPicker value="texto livre antigo"
      categories={categories} loading={false} error={false} onChange={onChange} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("Todas");
    rerender(<HomeCategoryPicker value="redes" categories={[]}
      loading={false} error={true} onChange={onChange} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("Todas");
    expect(screen.getByRole("status").textContent).toContain("buscar por município");
    rerender(<HomeCategoryPicker value="redes" categories={[]}
      loading={true} error={false} onChange={onChange} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
  });
});
