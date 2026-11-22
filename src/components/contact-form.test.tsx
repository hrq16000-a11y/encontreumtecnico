// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContactForm } from "./contact-form";

const insert = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => {
    if (table !== "contact_messages") throw new Error("Unexpected table");
    return { insert };
  } },
}));

beforeEach(() => insert.mockReset());
afterEach(() => cleanup());

describe("Suporte de acesso — envio simulado, sem registros reais", () => {
  it("preserva campos após exceção e permite sucesso em nova tentativa manual", async () => {
    insert.mockRejectedValueOnce(new Error("Conexão indisponível"))
      .mockResolvedValueOnce({ error: null });
    render(<ContactForm initialSubject="Dificuldade de acesso ou cadastro"
      submitLabel="Enviar solicitação de ajuda" />);

    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), {
      target: { value: "Cliente Exemplo" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "E-mail" }), {
      target: { value: "cliente@example.test" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Mensagem" }), {
      target: { value: "Não consigo acessar minha conta após confirmar o cadastro." },
    });
    const send = screen.getByRole("button", { name: "Enviar solicitação de ajuda" });
    fireEvent.click(send);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar");
    expect(send).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("Cliente Exemplo");
    expect(screen.getByRole("textbox", { name: "E-mail" })).toHaveValue("cliente@example.test");
    expect(screen.getByRole("textbox", { name: "Assunto" })).toHaveValue("Dificuldade de acesso ou cadastro");
    expect(screen.getByRole("textbox", { name: "Mensagem" }))
      .toHaveValue("Não consigo acessar minha conta após confirmar o cadastro.");
    expect(insert).toHaveBeenCalledTimes(1);

    fireEvent.click(send);
    await waitFor(() => expect(screen.getByRole("status"))
      .toHaveTextContent("Mensagem recebida"));
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenLastCalledWith({
      name: "Cliente Exemplo", email: "cliente@example.test",
      subject: "Dificuldade de acesso ou cadastro",
      message: "Não consigo acessar minha conta após confirmar o cadastro.",
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "E-mail" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Mensagem" })).toHaveValue("");
  });
});
