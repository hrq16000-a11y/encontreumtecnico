import { describe, expect, it, vi } from "vitest";
import { emitErrorSignal, errorSignalArea, parseErrorSignal } from "./error-signal";
import { handleErrorSignal } from "./error-signal.server";

function signalRequest(body: unknown, origin = "https://encontreumtecnico.com.br") {
  return new Request("https://encontreumtecnico.com.br/api/error-signal", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("sensor de erros sem dados pessoais", () => {
  it("reduz URLs públicas e privadas a poucas categorias sem slugs", () => {
    expect(errorSignalArea("/tecnicos/slug-com-telefone-5541999999999")).toBe("catalogo");
    expect(errorSignalArea("/admin/tecnicos")).toBe("admin");
    expect(errorSignalArea("/area-cliente")).toBe("atendimento");
    expect(errorSignalArea("/caminho-com-token-privado")).toBe("outras");
  });

  it("recusa payloads com mensagem, stack, telefone ou campo desconhecido", () => {
    const safe = { kind: "route_error", area: "catalogo", status: 500 };
    expect(parseErrorSignal(safe)).toEqual(safe);
    expect(parseErrorSignal({ ...safe, message: "telefone 5541999999999" })).toBeNull();
    expect(parseErrorSignal({ ...safe, stack: "segredo" })).toBeNull();
    expect(parseErrorSignal({ ...safe, area: "/tecnicos/fulano" })).toBeNull();
    expect(parseErrorSignal({ ...safe, status: 200 })).toBeNull();
  });

  it("envia uma única categoria sem slug, pesquisa, credenciais ou texto de erro", () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", send);
    window.history.replaceState({}, "", "/tecnicos/apelido-5541999999999?telefone=privado");
    try {
      emitErrorSignal("window_error", 500);
      emitErrorSignal("window_error", 500);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0]).toBe("/api/error-signal");
      expect(JSON.parse(send.mock.calls[0]?.[1].body)).toEqual({
        kind: "window_error", area: "catalogo", status: 500,
      });
      expect(send.mock.calls[0]?.[1].credentials).toBe("omit");
    } finally {
      vi.unstubAllGlobals();
      window.history.replaceState({}, "", "/");
    }
  });

  it("aceita somente mesma origem e registra apenas tipo, área e status", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const response = await handleErrorSignal(signalRequest({
        kind: "route_error", area: "catalogo", status: 500,
      }));
      expect(response.status).toBe(204);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(warn).toHaveBeenCalledWith("[EUT_ERROR_SIGNAL]", "route_error", "catalogo", 500);

      expect((await handleErrorSignal(signalRequest({ kind: "route_error", area: "admin", status: 500 }, "https://evil.example"))).status).toBe(403);
      expect((await handleErrorSignal(signalRequest({ kind: "route_error", area: "admin", status: 500, phone: "5541999999999" }))).status).toBe(400);
      expect((await handleErrorSignal(signalRequest({ kind: "route_error", area: "admin", status: 500, padding: "x".repeat(300) }))).status).toBe(413);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
