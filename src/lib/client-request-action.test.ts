import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ownedRequestForAction } from "./client-request-action";

const original = {
  id: "req-1", client_id: "client-a", technician_id: "tech-1", status: "aberta",
};
const rows = [
  original,
  { id: "req-2", client_id: "client-b", technician_id: "tech-2", status: "aberta" },
  { id: "req-3", client_id: "client-a", technician_id: null, status: "aberta" },
  { id: "req-4", client_id: "client-a", technician_id: "tech-1", status: "cancelada" },
  { id: "req-5", client_id: "client-a", technician_id: "tech-1", status: "aceita" },
];

describe("ações de um cliente sobre o próprio pedido", () => {
  it("impede compartilhar pedidos sem sessão, sem alvo ou de outra conta", () => {
    expect(ownedRequestForAction(rows, null, "req-1", "share")).toBeNull();
    expect(ownedRequestForAction(rows, "client-a", "req-2", "share")).toBeNull();
    expect(ownedRequestForAction(rows, "client-a", "req-3", "share")).toBeNull();
    expect(ownedRequestForAction(rows, "client-a", "req-4", "share")).toBeNull();
    expect(ownedRequestForAction(rows, "client-a", "req-5", "share")).toBeNull();
    expect(ownedRequestForAction(null, "client-a", "req-1", "share")).toBeNull();
  });
  it("permite compartilhamento somente do próprio pedido aberto com técnico", () => {
    expect(ownedRequestForAction(rows, "client-a", "req-1", "share")).toEqual(original);
    expect(ownedRequestForAction(rows, "client-b", "req-2", "share")?.client_id).toBe("client-b");
  });
  it("permite cancelar pedidos próprios ainda abertos ou antigos aceitos", () => {
    expect(ownedRequestForAction(rows, "client-a", "req-1", "cancel")).toEqual(original);
    expect(ownedRequestForAction(rows, "client-a", "req-3", "cancel")?.id).toBe("req-3");
    expect(ownedRequestForAction(rows, "client-a", "req-5", "cancel")?.id).toBe("req-5");
    expect(ownedRequestForAction(rows, "client-a", "req-4", "cancel")).toBeNull();
    expect(ownedRequestForAction(rows, "client-b", "req-1", "cancel")).toBeNull();
  });
  it("libera o envio pendente na troca de conta sem reaproveitar resposta antiga", () => {
    const component = readFileSync("src/routes/area-cliente.tsx", "utf8");
    const reset = component.match(/useEffect\\(\\(\\) => \\{\\s*\\/\\/ Never reuse[\\s\\S]*?\\}, \\[user\\?\\.id\\]\\);/);
    expect(reset?.[0]).toContain("setSendingId(null)");
    expect(reset?.[0]).toContain("setShareNow(false)");
    expect(reset?.[0]).toContain("pendingSubmission.current = null");
    expect(component).toContain("if (currentUserIdRef.current !== owner) return;");
    expect(component).toContain("if (currentUserIdRef.current === owner) setSendingId(null);");
  });

  it("não aceita um id semelhante, omisso ou estado incorreto", () => {
    expect(ownedRequestForAction(rows, "client-a", "req", "share")).toBeNull();
    expect(ownedRequestForAction(rows, "client-a", "", "cancel")).toBeNull();
    expect(ownedRequestForAction([{ ...original, status: "concluida" }], "client-a", "req-1", "cancel")).toBeNull();
  });
});
