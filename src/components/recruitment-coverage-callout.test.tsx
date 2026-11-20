// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  REGIONAL_RECRUITMENT_UFS, RECRUITMENT_CITY_GROUPS, RECRUITMENT_CITY_COUNT,
  RecruitmentCoverageCallout,
} from "./recruitment-coverage-callout";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, search, children }: { to: string; search?: Record<string, string>; children: ReactNode }) =>
    <a href={to + (search ? "?" + new URLSearchParams(search).toString() : "")}>{children}</a>,
}));

afterEach(cleanup);

describe("recrutamento regional sem promessas de disponibilidade", () => {
  it("preserva as 65 cidades e a priorização dos cinco estados de abrangência", () => {
    expect(REGIONAL_RECRUITMENT_UFS).toEqual(["PR", "SC", "RS", "SP", "RJ"]);
    expect(RECRUITMENT_CITY_GROUPS).toHaveLength(18);
    expect(RECRUITMENT_CITY_COUNT).toBe(65);
    const ids = RECRUITMENT_CITY_GROUPS.flatMap((g) => g.cities.map((city) => g.uf + ":" + city));
    expect(new Set(ids).size).toBe(65);
    expect(ids).toContain("CE:Cascavel");
    expect(ids).toContain("MT:Rio Branco");
    expect(ids).toContain("TO:Cachoeirinha");
    expect(ids).not.toContain("TO:Cachoeirinhas");
  });

  it("encaminha cidades à busca filtrada e técnicos ao cadastro, sem números fictícios", () => {
    render(<RecruitmentCoverageCallout />);
    expect(screen.getByRole("heading", { name: /Procuramos técnicos em novas localidades/ })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /^Consultar .*\/..$/ })).toHaveLength(65);
    const link = screen.getByRole("link", { name: "Consultar Cascavel/CE" });
    expect(link.getAttribute("href")).toContain("cidade=Cascavel");
    expect(link.getAttribute("href")).toContain("uf=CE");
    expect(screen.getByRole("link", { name: /Sou técnico: cadastrar meu perfil/ }).getAttribute("href")).toBe("/cadastro");
    expect(screen.queryByText(/300 demandas|clientes garantidos|técnicos disponíveis agora/i)).toBeNull();
  });
});
