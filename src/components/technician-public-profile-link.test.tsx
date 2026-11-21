import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TechnicianPublicProfileLink } from "./technician-public-profile-link";

const getProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/technicians.functions", () => ({
  getApprovedTechnician: getProfile,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ params, children }: { params: { tecnicoId: string }; children: ReactNode }) => (
    <a href={`/tecnicos/${params.tecnicoId}`}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  getProfile.mockReset();
});

function renderLink() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <TechnicianPublicProfileLink ownerId="owner" profileId="profile">
        Abrir perfil
      </TechnicianPublicProfileLink>
    </QueryClientProvider>,
  );
}

describe("link público da ficha salva", () => {
  it("consulta o ID estável e oferece o slug canônico atual da mesma ficha", async () => {
    getProfile.mockResolvedValue({ id: "profile", public_slug: "canonical-slug" });
    renderLink();
    expect(await screen.findByRole("link", { name: "Abrir perfil" })).toHaveAttribute("href", "/tecnicos/canonical-slug");
    expect(getProfile).toHaveBeenCalledWith({ data: { id: "profile" } });
  });

  it.each([null, { id: "other", public_slug: "unrelated" }])(
    "omite o link se o catálogo não devolve a própria ficha",
    async (result) => {
      getProfile.mockResolvedValue(result);
      renderLink();
      await screen.findByText(/ainda não aparece no catálogo público/);
      expect(screen.queryByRole("link")).toBeNull();
    },
  );

  it("oferece nova consulta em caso de erro, sem link ou ação de publicação", async () => {
    getProfile.mockRejectedValue(new Error("unavailable"));
    renderLink();
    expect(await screen.findByRole("button", { name: "Consultar novamente" })).toHaveAttribute("type", "button");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("permite consultar novamente quando uma ficha antes invisível passa a constar no catálogo", async () => {
    getProfile
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "profile", public_slug: "canonical-slug" });
    renderLink();

    const retry = await screen.findByRole("button", { name: "Consultar novamente" });
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(retry);

    expect(await screen.findByRole("link", { name: "Abrir perfil" })).toHaveAttribute(
      "href",
      "/tecnicos/canonical-slug",
    );
    expect(getProfile).toHaveBeenCalledTimes(2);
  });

});
