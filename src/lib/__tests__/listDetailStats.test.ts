import { describe, expect, it } from "vitest";
import { computeListDetailStats } from "../listDetailStats";

const NOW = new Date("2026-08-22T12:00:00Z");
const PAST = new Date("2026-08-20T00:00:00Z");
const FUTURE = new Date("2026-08-25T00:00:00Z");

describe("computeListDetailStats", () => {
  it("starts at 0 learned right after a plain enroll (all rows NEW)", () => {
    // Enroll bulk-creates a NEW row per word — the exact shape that used to
    // read as "300 of 300 in your queue" on the old hand-rolled predicate.
    const progress = [
      { state: "NEW", dueAt: NOW },
      { state: "NEW", dueAt: NOW },
      { state: "NEW", dueAt: NOW },
    ];
    const stats = computeListDetailStats(progress, 3, NOW);
    expect(stats.learnedCount).toBe(0);
    expect(stats.strongPct).toBe(0);
  });

  it("learnedCount grows as words move off NEW", () => {
    const progress = [
      { state: "LEARNING", dueAt: FUTURE },
      { state: "REVIEW", dueAt: FUTURE },
      { state: "NEW", dueAt: NOW },
    ];
    const stats = computeListDetailStats(progress, 3, NOW);
    expect(stats.learnedCount).toBe(2);
  });

  it("dueCount excludes MASTERED — a mastered card is never due", () => {
    const progress = [
      { state: "MASTERED", dueAt: PAST },
      { state: "REVIEW", dueAt: PAST },
      { state: "ASSUMED", dueAt: PAST },
    ];
    const stats = computeListDetailStats(progress, 3, NOW);
    expect(stats.dueCount).toBe(1);
  });

  it("dueCount excludes not-yet-due cards even in a due-eligible state", () => {
    const progress = [{ state: "REVIEW", dueAt: FUTURE }];
    const stats = computeListDetailStats(progress, 1, NOW);
    expect(stats.dueCount).toBe(0);
  });

  it("strongPct divides by total list size, not enrolled count", () => {
    // Only 2 of 10 words enrolled, both REVIEW — should read 20%, not 100%.
    const progress = [
      { state: "REVIEW", dueAt: FUTURE },
      { state: "REVIEW", dueAt: FUTURE },
    ];
    const stats = computeListDetailStats(progress, 10, NOW);
    expect(stats.strongPct).toBe(20);
  });

  it("handles an empty list without dividing by zero", () => {
    const stats = computeListDetailStats([], 0, NOW);
    expect(stats).toEqual({ dueCount: 0, learnedCount: 0, strongPct: 0 });
  });
});
