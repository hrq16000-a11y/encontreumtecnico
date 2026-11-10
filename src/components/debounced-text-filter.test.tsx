import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebouncedTextFilter, FILTER_DEBOUNCE_MS } from "./debounced-text-filter";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
