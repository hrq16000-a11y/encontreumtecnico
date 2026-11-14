// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const channel = {
    subscribe: vi.fn(), track: vi.fn().mockResolvedValue({}), untrack: vi.fn().mockResolvedValue({}),
  };
  return { channel, connect: vi.fn(), remove: vi.fn().mockResolvedValue({}) };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { channel: fake.connect.mockImplementation(() => fake.channel), removeChannel: fake.remove },
}));
import { ConsentedVisitorPresence } from "./consented-visitor-presence";

describe("publicador de presença temporária", () => {
  beforeEach(() => {
    localStorage.clear(); fake.connect.mockClear(); fake.remove.mockClear();
    fake.channel.subscribe.mockClear(); fake.channel.track.mockClear(); fake.channel.untrack.mockClear();
  });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it("não abre conexão sem consentimento específico, mesmo com analytics ativo", () => {
    localStorage.setItem("eut-cookie-consent", '{"analytics":true}');
    render(<ConsentedVisitorPresence pathname="/" />);
    expect(fake.connect).not.toHaveBeenCalled();
  });

  it("publica apenas marcador anônimo, revoga e encerra o canal", () => {
    render(<ConsentedVisitorPresence pathname="/" />);
    localStorage.setItem("eut-cookie-consent", '{"presence":true}');
    act(() => { window.dispatchEvent(new Event("eut-consent-changed")); });
    expect(fake.connect).toHaveBeenCalledWith("eut-consented-visitor-tabs-v1");
    const callback = fake.channel.subscribe.mock.calls[0]?.[0] as (status: string) => void;
    act(() => { callback("SUBSCRIBED"); });
    expect(fake.channel.track).toHaveBeenCalledWith({ kind: "consented-visitor-tab" });
    expect(JSON.stringify(fake.channel.track.mock.calls)).not.toMatch(/email|ip|city|url|user_id/);
    localStorage.setItem("eut-cookie-consent", '{"presence":false}');
    act(() => { window.dispatchEvent(new Event("eut-consent-changed")); });
    expect(fake.channel.untrack).toHaveBeenCalled();
    expect(fake.remove).toHaveBeenCalledWith(fake.channel);
  });

  it("nunca conecta a área administrativa, mesmo após consentimento", () => {
    localStorage.setItem("eut-cookie-consent", '{"presence":true}');
    render(<ConsentedVisitorPresence pathname="/admin/metricas" />);
    expect(fake.connect).not.toHaveBeenCalled();
  });
});
