import { describe, expect, it } from "vitest";
import { confirmedTechnicianArchiveResult } from "./admin-technician-archive-confirmation";

const id = "00000000-0000-4000-8000-000000000284";

describe("confirmação de arquivamento administrativo", () => {
  it("confirma arquivamento apenas com estado inativo", () => {
    expect(confirmedTechnicianArchiveResult({ ok: true, technician_id: id, archived: true, admin_active: false }, id, "archive")).toBe(true);
    expect(confirmedTechnicianArchiveResult({ ok: true, technician_id: id, archived: true, admin_active: true }, id, "archive")).toBe(false);
  });

  it.each([true, false])("aceita restauração ao estado anterior admin_active=%s", (previousActive) => {
    expect(confirmedTechnicianArchiveResult({ ok: true, technician_id: id, archived: false, admin_active: previousActive }, id, "restore")).toBe(true);
  });

  it("rejeita respostas inconsistentes, sem presumir sucesso", () => {
    expect(confirmedTechnicianArchiveResult(null, id, "restore")).toBe(false);
    expect(confirmedTechnicianArchiveResult({ ok: true, technician_id: "outro", archived: false, admin_active: true }, id, "restore")).toBe(false);
    expect(confirmedTechnicianArchiveResult({ ok: true, technician_id: id, archived: true, admin_active: true }, id, "restore")).toBe(false);
    expect(confirmedTechnicianArchiveResult({ ok: true, technician_id: id, archived: false }, id, "restore")).toBe(false);
  });
});
