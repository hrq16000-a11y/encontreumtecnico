// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/components/admin-technician-record-editor", () => ({
  AdminTechnicianRecordEditor: ({ sourceId, existing, onSaved }: {
    sourceId: string; existing: { technician_id: string }; onSaved: (message: string) => void;
  }) => <button type="button" data-testid="audited-editor"
    onClick={() => onSaved("Salvo e conferido")}>
    {sourceId} — {existing.technician_id}
  </button>,
}));

import { AdminRegistryRecordInlineEditor } from "./admin-registry-record-inline-editor";

const target = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const record = (id: string, name = "Técnico Importado") => ({
  technician_id: id, display_name: name, origin: "other_import",
  source_id: "import:fonte:123", updated_at: "2026-11-23T01:00:00Z",
  total_count: 2,
});
beforeEach(() => rpc.mockReset());
afterEach(cleanup);

describe("Usuários 360°: edição auditada por identidade exata", () => {
  it("reutiliza o editor só quando a RPC confirma o UUID, não apenas o nome", async () => {
    const onSaved = vi.fn();
    rpc.mockResolvedValue({ data: [record(other), record(target)], error: null });
    render(<AdminRegistryRecordInlineEditor
      recordKey={`registry:${target}`} name="Técnico Importado"
      onSaved={onSaved} onCancel={vi.fn()} />);
    const editor = await screen.findByTestId("audited-editor");
    expect(editor.textContent).toContain(target);
    expect(editor.textContent).not.toContain(other);
    expect(rpc).toHaveBeenCalledWith("eut_admin_technician_registry_list", {
      _search: "Técnico Importado", _limit: 100, _offset: 0,
    });
    fireEvent.click(editor);
    expect(onSaved).toHaveBeenCalledWith("Salvo e conferido");
  });

  it("nunca abre editor para resultado semelhante com identificador diferente", async () => {
    rpc.mockResolvedValue({ data: [record(other)], error: null });
    render(<AdminRegistryRecordInlineEditor
      recordKey={`registry:${target}`} name="Técnico Importado"
      onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Ficha exata não localizada");
    expect(screen.queryByTestId("audited-editor")).toBeNull();
  });

  it("bloqueia escrita quando falha a autorização ou o identificador não é válido", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    const { rerender } = render(<AdminRegistryRecordInlineEditor
      recordKey={`registry:${target}`} name="Técnico Importado"
      onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conferir");
    expect(screen.queryByTestId("audited-editor")).toBeNull();
    rerender(<AdminRegistryRecordInlineEditor
      recordKey="imported:sem-fk" name="Técnico Importado"
      onSaved={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Identificador da ficha inválido"));
    expect(screen.queryByTestId("audited-editor")).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
