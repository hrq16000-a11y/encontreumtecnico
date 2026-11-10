import { describe, expect, it, vi } from "vitest";
import { persistClientRequest } from "./client-request-save";

describe("client request persistence and explicit share", () => {
  it("persists privately without sending any direct message by default", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const share = vi.fn(async () => ({ error: null, data: { status: "enviado" } }));
    expect(await persistClientRequest(insert)).toBe("stored_private");
    expect(insert).toHaveBeenCalledOnce();
    expect(share).not.toHaveBeenCalled();
  });

  it("confirms the directed share only after both operations are confirmed", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const share = vi.fn(async () => ({ error: null, data: { status: "enviado" } }));
    expect(await persistClientRequest(insert, share)).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
  });

  it("does not share or claim success when the insert is rejected", async () => {
    const share = vi.fn(async () => ({ error: null, data: { status: "enviado" } }));
    expect(await persistClientRequest(async () => ({ error: { code: "23505" } }), share))
      .toBe("save_rejected");
    expect(share).not.toHaveBeenCalled();
  });

  it("does not share or falsely claim rollback after network error on insert", async () => {
    const share = vi.fn(async () => ({ error: null, data: { status: "enviado" } }));
    expect(await persistClientRequest(async () => { throw Error("timeout"); }, share))
      .toBe("save_unconfirmed");
    expect(share).not.toHaveBeenCalled();
  });

  it("keeps saved request distinct from unconfirmed sharing", async () => {
    const success = async () => ({ error: null });
    expect(await persistClientRequest(success, async () => ({ error: { message: "offline" } })))
      .toBe("share_unconfirmed");
    expect(await persistClientRequest(success, async () => ({ error: null, data: { status: "other" } })))
      .toBe("share_unconfirmed");
    expect(await persistClientRequest(success, async () => { throw Error("connection lost"); }))
      .toBe("share_unconfirmed");
  });
});
