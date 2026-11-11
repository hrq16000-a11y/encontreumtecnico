// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const fake = vi.hoisted(() => ({
  data: [] as Array<Record<string, unknown>>,
  loading: false,
  error: false,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, ...props }: {
    to: string; params?: { tecnicoId?: string }; children: ReactNode; [key: string]: unknown;
  }) => <a href={params?.tecnicoId ? "/tecnicos/" + params.tecnicoId : to}
    aria-label={typeof props["aria-label"] === "string" ? props["aria-label"] : undefined}>{children}</a>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: fake.data, isError: fake.error, isFetching: fake.loading }),
}));

vi.mock("@/lib/technicians.functions", () => ({
  listApprovedTechnicians: vi.fn(),
}));

vi.mock("@/components/technician-avatar", () => ({
  TechnicianAvatar: ({ name }: { name: string }) => <span aria-label={"Avatar de " + name} />,
}));

import { HomePublicProof } from "./home-public-proof";

describe("prova social sem dados inventados", () => {
  afterEach(() => {
    cleanup();
    fake.data = [];
    fake.loading = false;
    fake.error = false;
  });

  it("apresenta apenas perfis reais retornados pela consulta pública", () => {
    fake.data = [
      { id: "1", public_slug: "tecnico-a-pr", display_name: "Técnico A", city: "Curitiba", state_uf: "PR", avatar_path: null },
      { id: "2", public_slug: "tecnico-b-sp", display_name: "Técnico B", city: "São Paulo", state_uf: "SP", avatar_path: null },
      { id: "3", public_slug: "", display_name: "Sem slug", city: "Rio", state_uf: "RJ" },
      { id: "4", public_slug: "tecnico-c-rs", display_name: "Técnico C", city: "Porto Alegre", state_uf: "RS", avatar_path: null },
      { id: "5", public_slug: "tecnico-d-sc", display_name: "Técnico D", city: "Florianópolis", state_uf: "SC", avatar_path: null },
    ];
    render(<HomePublicProof />);
    expect(screen.getByRole("heading", { name: /perfis públicos reais/i })).toBeTruthy();
    const links = screen.getAllByRole("link", { name: /ver perfil público de/i });
    expect(links).toHaveLength(3);
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      "/tecnicos/tecnico-a-pr", "/tecnicos/tecnico-b-sp", "/tecnicos/tecnico-c-rs",
    ]);
    expect(screen.queryByText("Sem slug")).toBeNull();
    expect(screen.queryByText(/5 estrelas|depoimento verificado/i)).toBeNull();
  });

  it("não exibe prova inventada quando a consulta falha", () => {
    fake.error = true;
    render(<HomePublicProof />);
    expect(screen.getByText(/Não foi possível carregar os exemplos agora/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /ver perfil público de/i })).toBeNull();
  });
});
