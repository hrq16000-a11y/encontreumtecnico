// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { AdminTechnician360SheetContent } from "./admin-technician-360-sheet";

vi.mock("@/components/admin-technician-contact-access", () => ({
  AdminTechnicianContactAccess: ({ recordKey }: { recordKey: string }) => (
    <span>Telefone do cadastro {recordKey}</span>
  ),
}));

const base = {
  key: "registry:teste-01",
  name: "Técnica Exemplo",
  location: "Curitiba/PR",
  specialty: "Informática",
  createdAt: "2026-11-10T12:00:00Z",
  updatedAt: "2026-11-11T12:00:00Z",
};

const registry = {
  technician_id: "tech-01",
  display_name: base.name,
  origin: "manual" as const,
  source_id: "manual:test-01",
  city_ibge_id: 4106902,
  ddd: "41",
  region_approx: "Curitiba e região",
  category_slugs: ["informatica"],
  service_slugs: ["manutencao-de-computadores"],
  admin_active: true,
  is_demo: false,
  archived: false,
  contact_last4: "11999998888", // Defensive: never show more than four digits, even with a malformed response.
  updated_at: "2026-11-11T12:00:00Z",
  total_count: 1,
};

function Fixture({
  status = "active",
  demo = false,
  archived = false,
  onEdit = vi.fn(),
}: {
  status?: "active" | "inactive" | "review";
  demo?: boolean;
  archived?: boolean;
  onEdit?: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button">Ver ficha</button>
      </SheetTrigger>
      {open && (
        <AdminTechnician360SheetContent
          record={{ ...base, demo, registry: { ...registry, archived } }}
          state={status}
          onEdit={onEdit}
        />
      )}
    </Sheet>
  );
}

afterEach(() => cleanup());

function openTab(name: string) {
  // Radix tabs activate on the primary mouse-down, as a real pointer click does.
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });
}

describe("ficha administrativa 360°", () => {
  it("mostra dados existentes e o campo de telefone sem etapa de revelação", () => {
    render(<Fixture />);
    expect(screen.getByRole("dialog", { name: /Ficha 360°/ })).toBeTruthy();
    expect(screen.getAllByText("Curitiba/PR").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ativo").length).toBeGreaterThan(0);
    expect(screen.queryByText("11999998888")).toBeNull();

    openTab("Contato");
    expect(screen.getByText(/Telefone do cadastro registry:teste-01/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("11999998888");

    openTab("Atuação");
    expect(screen.getByText("manutencao-de-computadores")).toBeTruthy();
    expect(screen.getAllByText(/região aproximada/).length).toBeGreaterThan(0);
    openTab("Histórico");
    expect(
      screen.getByText(/Ausência de dados aqui não significa ausência de histórico/),
    ).toBeTruthy();
  });

  it("mantém a suspensão e bloqueia edição e contato de registros de demonstração", () => {
    render(<Fixture status="inactive" demo archived />);
    expect(screen.getAllByText("Suspenso / arquivado").length).toBeGreaterThan(0);
    expect(screen.getByText(/não altera suspensões nem restaura contatos/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar cadastro" })).toBeNull();
    openTab("Contato");
    expect(screen.queryByText(/Telefone do cadastro registry:teste-01/)).toBeNull();
  });

  it("não oferece edição de registro arquivado, mesmo fora de demonstração", () => {
    render(<Fixture status="inactive" archived />);
    expect(screen.queryByRole("button", { name: "Editar cadastro" })).toBeNull();
    expect(screen.getByText(/não altera suspensões nem restaura contatos/)).toBeTruthy();
  });

  it("aciona o editor existente e fecha pelo botão acessível", () => {
    const onEdit = vi.fn();
    render(<Fixture onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar cadastro" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Fechar ficha" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Ver ficha" })).toBeTruthy();
  });

  it("fecha com Escape sem alterar o registro", () => {
    const onEdit = vi.fn();
    render(<Fixture onEdit={onEdit} />);
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
  });
});
