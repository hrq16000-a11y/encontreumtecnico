import { describe, expect, it } from "vitest";
import { containsObviousContact } from "./private-message-validation";

describe("avisos de dados de contato para pedidos consentidos", () => {
  it.each([
    "Pode falar comigo pelo 11987654321",
    "E-mail teste@exemplo.com",
    "Veja https://exemplo.com/pedido",
    "Veja www.exemplo.com",
    "Rua Exemplo 123",
    "Avenida Paulista 1234",
  ])("avisa quando há dados de contato reconhecíveis", (message) => {
    expect(containsObviousContact(message)).toBe(true);
  });
  it.each([
    "O notebook reinicia sozinho quando abro o editor.",
    "Atendo redes Wi-Fi em Curitiba e posso avaliar seu roteador.",
    "A impressora parou de funcionar nesta semana.",
  ])("permite comunicação técnica sem contato", (message) => {
    expect(containsObviousContact(message)).toBe(false);
  });
});
