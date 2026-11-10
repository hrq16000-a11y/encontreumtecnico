import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTechnicianTarget, recallTechnicianTarget, rememberTechnicianTarget } from "./selected-technician-target";

const ID = "dfb569e7-c116-4519-8df2-5c7a10a20318";

describe("selected technician survives a login redirect", () => {
  beforeEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });
  it("remembers the selected public profile ID in the tab", () => {
    expect(rememberTechnicianTarget(ID)).toBe(true);
    expect(recallTechnicianTarget()).toBe(ID);
    clearTechnicianTarget();
    expect(recallTechnicianTarget()).toBeNull();
  });
  it("does not remember arbitrary strings or non-UUID values", () => {
    expect(rememberTechnicianTarget("https://other.example")).toBe(false);
    expect(recallTechnicianTarget()).toBeNull();
  });
  it("expires after thirty minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T20:00:00Z"));
    expect(rememberTechnicianTarget(ID)).toBe(true);
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(recallTechnicianTarget()).toBeNull();
    vi.useRealTimers();
  });
});
