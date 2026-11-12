// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  getUser: vi.fn(),
  queryRoles: vi.fn(),
  notify: null as null | ((event: string, session: { user: { id: string } } | null) => void),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mocked.getUser,
      onAuthStateChange: (listener: typeof mocked.notify) => {
        mocked.notify = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: (table: string) => {
      if (table !== "user_roles") throw new Error("Unexpected table in auth hook test");
      return { select: () => ({ eq: (_field: string, owner: string) => mocked.queryRoles(owner) }) };
    },
  },
}));

import { useAuth } from "./use-auth";

const user = (id: string) => ({ id });
const roles = (...names: string[]) => ({ data: names.map((role) => ({ role })), error: null });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

describe("role isolation after Google/email login", () => {
  beforeEach(() => {
    mocked.notify = null;
    mocked.getUser.mockReset();
    mocked.queryRoles.mockReset();
    mocked.getUser.mockResolvedValue({ data: { user: user("account-a") }, error: null });
  });

  it("clears the previous account role before a new account's role query completes", async () => {
    const pendingB = deferred<ReturnType<typeof roles>>();
    mocked.queryRoles.mockImplementation((owner: string) =>
      owner === "account-a" ? Promise.resolve(roles("cliente")) : pendingB.promise);
    const hook = renderHook(() => useAuth());
    await waitFor(() => expect(hook.result.current.roles).toEqual(["cliente"]));
    await waitFor(() => expect(mocked.notify).not.toBeNull());

    await act(async () => {
      mocked.notify?.("SIGNED_IN", { user: user("account-b") });
      await Promise.resolve();
    });
    expect(hook.result.current.user?.id).toBe("account-b");
    expect(hook.result.current.roles).toEqual([]);
    expect(hook.result.current.loading).toBe(true);

    await act(async () => { pendingB.resolve(roles("tecnico")); });
    await waitFor(() => expect(hook.result.current.roles).toEqual(["tecnico"]));
    expect(hook.result.current.loading).toBe(false);
    hook.unmount();
  });

  it("ignores old role responses and old refreshRoles when a user signs out", async () => {
    const pendingRefresh = deferred<ReturnType<typeof roles>>();
    let calls = 0;
    mocked.queryRoles.mockImplementation(() => {
      calls++;
      return calls === 1 ? Promise.resolve(roles("admin")) : pendingRefresh.promise;
    });
    const hook = renderHook(() => useAuth());
    await waitFor(() => expect(hook.result.current.roles).toEqual(["admin"]));
    await waitFor(() => expect(mocked.notify).not.toBeNull());

    // Simulate a refresh pending while the account signs out.
    await act(async () => { void hook.result.current.refreshRoles(); });
    expect(hook.result.current.loading).toBe(true);
    await act(async () => {
      mocked.notify?.("SIGNED_OUT", null);
      await Promise.resolve();
    });
    expect(hook.result.current.user).toBeNull();
    expect(hook.result.current.roles).toEqual([]);
    expect(hook.result.current.loading).toBe(false);
    await act(async () => { pendingRefresh.resolve(roles("admin")); });
    expect(hook.result.current.roles).toEqual([]);
    hook.unmount();
  });

  it("does not expose roles for a later account when an older query arrives last", async () => {
    const pendingB = deferred<ReturnType<typeof roles>>();
    mocked.queryRoles.mockImplementation((owner: string) => {
      if (owner === "account-a") return Promise.resolve(roles("cliente"));
      if (owner === "account-b") return pendingB.promise;
      return Promise.resolve(roles("tecnico"));
    });
    const hook = renderHook(() => useAuth());
    await waitFor(() => expect(hook.result.current.roles).toEqual(["cliente"]));
    await waitFor(() => expect(mocked.notify).not.toBeNull());

    await act(async () => {
      mocked.notify?.("SIGNED_IN", { user: user("account-b") });
      await Promise.resolve();
    });
    await act(async () => {
      mocked.notify?.("SIGNED_IN", { user: user("account-c") });
      await Promise.resolve();
    });
    await waitFor(() => expect(hook.result.current.roles).toEqual(["tecnico"]));
    await act(async () => { pendingB.resolve(roles("admin")); });
    expect(hook.result.current.user?.id).toBe("account-c");
    expect(hook.result.current.roles).toEqual(["tecnico"]);
    hook.unmount();
  });
  it.each(["tecnico", "admin"] as const)(
    "preserva o papel %s sem desmontar formulários no retorno Alt+Tab",
    async (role) => {
      mocked.queryRoles.mockResolvedValue(roles(role));
      const hook = renderHook(() => useAuth());
      await waitFor(() => expect(hook.result.current.loading).toBe(false));
      await waitFor(() => expect(mocked.notify).not.toBeNull());
      const calls = mocked.queryRoles.mock.calls.length;
      await act(async () => {
        mocked.notify?.("SIGNED_IN", { user: user("account-a") });
        mocked.notify?.("INITIAL_SESSION", { user: user("account-a") });
        mocked.notify?.("USER_UPDATED", { user: user("account-a") });
        await Promise.resolve();
      });
      expect(hook.result.current.user?.id).toBe("account-a");
      expect(hook.result.current.roles).toEqual([role]);
      expect(hook.result.current.loading).toBe(false);
      expect(mocked.queryRoles).toHaveBeenCalledTimes(calls);
      hook.unmount();
    },
  );

  it("ignora SIGNED_IN duplicado ao voltar para a aba com a mesma conta", async () => {
    mocked.queryRoles.mockResolvedValue(roles("cliente"));
    const hook = renderHook(() => useAuth());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await waitFor(() => expect(mocked.notify).not.toBeNull());
    const originalCalls = mocked.queryRoles.mock.calls.length;
    await act(async () => {
      mocked.notify?.("SIGNED_IN", { user: user("account-a") });
      mocked.notify?.("INITIAL_SESSION", { user: user("account-a") });
      await Promise.resolve();
    });
    expect(hook.result.current.user?.id).toBe("account-a");
    expect(hook.result.current.roles).toEqual(["cliente"]);
    expect(hook.result.current.loading).toBe(false);
    expect(mocked.queryRoles).toHaveBeenCalledTimes(originalCalls);
    hook.unmount();
  });
});
