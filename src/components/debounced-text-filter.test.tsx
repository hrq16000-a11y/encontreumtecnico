import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { savePendingFilter, readPendingFilter } from "@/lib/pending-search-filter";
import { DebouncedTextFilter, FILTER_DEBOUNCE_MS } from "./debounced-text-filter";

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function form(value = "", onCommit = vi.fn(), onBlurTrack = vi.fn()) {
  return <DebouncedTextFilter id="filtro-bairro" label="Bairro" value={value}
    placeholder="Ex.: Centro" onCommit={onCommit} onBlurTrack={onBlurTrack} />;
}

describe("localidade: digitação sem consultas por tecla", () => {
  it("mantém digitação imediata e só confirma após uma pausa", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(form("", onCommit));
    const input = screen.getByLabelText("Bairro") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "C" } });
    fireEvent.change(input, { target: { value: "Cr" } });
    fireEvent.change(input, { target: { value: "Cristal" } });
    expect(input.value).toBe("Cristal");
    expect(onCommit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(FILTER_DEBOUNCE_MS - 1));
    expect(onCommit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Cristal");
  });

  it("confirma ao sair do campo, cancela debounce e não duplica consulta", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const onBlurTrack = vi.fn();
    render(form("", onCommit, onBlurTrack));
    const input = screen.getByLabelText("Bairro");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Centro" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Centro");
    expect(onBlurTrack).toHaveBeenCalledWith("Centro");
    act(() => vi.advanceTimersByTime(FILTER_DEBOUNCE_MS * 2));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("sincroniza uma nova URL quando o campo não está em edição", () => {
    const onCommit = vi.fn();
    const onBlurTrack = vi.fn();
    const view = render(form("Centro", onCommit, onBlurTrack));
    const input = screen.getByLabelText("Bairro") as HTMLInputElement;
    expect(input.value).toBe("Centro");
    view.rerender(form("Cristal", onCommit, onBlurTrack));
    expect(input.value).toBe("Cristal");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("recupera o último caractere na remontagem, sem ser apagado pelo valor anterior da URL", () => {
    vi.useFakeTimers();
    savePendingFilter("filtro-bairro", "", "Cristal", sessionStorage);
    const onCommit = vi.fn();
    render(form("", onCommit));
    expect((screen.getByLabelText("Bairro") as HTMLInputElement).value).toBe("Cristal");
    act(() => vi.advanceTimersByTime(FILTER_DEBOUNCE_MS));
    expect(onCommit).toHaveBeenCalledWith("Cristal");
  });

  it("Alt+Tab conserva o texto e não faz nova consulta até a aba voltar", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(form("", onCommit));
    const field = screen.getByLabelText("Bairro") as HTMLInputElement;
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "Boqueirão" } });
    vi.mocked(document.hasFocus).mockReturnValue(false);
    fireEvent.blur(field);
    act(() => vi.advanceTimersByTime(FILTER_DEBOUNCE_MS * 2));
    expect(onCommit).not.toHaveBeenCalled();
    expect(readPendingFilter("filtro-bairro", "")).toBe("Boqueirão");
    vi.mocked(document.hasFocus).mockReturnValue(true);
    act(() => fireEvent.focus(window));
    act(() => vi.advanceTimersByTime(FILTER_DEBOUNCE_MS));
    expect(onCommit).toHaveBeenCalledWith("Boqueirão");
  });

  it("histórico com filtro diferente tem prioridade e cancela commit antigo", () => {
    vi.useFakeTimers();
    savePendingFilter("filtro-bairro", "", "Cristal", sessionStorage);
    const onCommit = vi.fn();
    const view = render(form("", onCommit));
    view.rerender(form("Centro", onCommit));
    expect((screen.getByLabelText("Bairro") as HTMLInputElement).value).toBe("Centro");
    act(() => vi.advanceTimersByTime(FILTER_DEBOUNCE_MS * 2));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("não faz commit após desmontar o componente", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const view = render(form("", onCommit));
    fireEvent.change(screen.getByLabelText("Bairro"), { target: { value: "Cristal" } });
    view.unmount();
    act(() => vi.advanceTimersByTime(FILTER_DEBOUNCE_MS * 2));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
