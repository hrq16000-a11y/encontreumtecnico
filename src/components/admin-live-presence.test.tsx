// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ session: vi.fn(), count: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: fake.session } },
}));
vi.mock("@/lib/visitor-http-presence", () => ({
  HTTP_PRESENCE_READY: true, // Forced in jsdom only, not in the actual build.
  readAdminPresenceCount: fake.count,
}));
import { AdminLivePresence } from "./admin-live-presence";

describe("consumidor administrativo HTTP (somente adaptador)", () => {
  beforeEach(() => {
    fake.session.mockReset().mockResolvedValue({ data: { session: { access_token: "synthetic.jwt.token" } }, error: null });
    fake.count.mockReset();
  });
  afterEach(() => cleanup());

  it("apresenta somente contagem devolvida pelo endpoint administrativo", async () => {
    fake.count.mockResolvedValue(7);
    render(<AdminLivePresence />);
    await waitFor(() => expect(screen.getByText("7")).toBeTruthy());
    expect(fake.count).toHaveBeenCalledWith("synthetic.jwt.token");
    expect(screen.getByText(/não são pessoas únicas/)).toBeTruthy();
  });

  it("falha fechado se a sessão ou a autorização de leitura estiver ausente", async () => {
    fake.session.mockResolvedValue({ data: { session: null }, error: null });
    render(<AdminLivePresence />);
    await waitFor(() => expect(screen.getByText(/Presença indisponível/)).toBeTruthy());
    expect(fake.count).not.toHaveBeenCalled();
  });

  it("não transforma falha do servidor em contagem zero", async () => {
    fake.count.mockRejectedValue(new Error("403"));
    render(<AdminLivePresence />);
    await waitFor(() => expect(screen.getByText(/Presença indisponível/)).toBeTruthy());
    expect(screen.queryByText("0")).toBeNull();
  });
});
