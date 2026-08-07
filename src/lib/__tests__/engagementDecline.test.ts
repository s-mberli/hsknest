import { describe, expect, it } from "vitest";

import { isDeclining, weekLabel } from "@/lib/engagementDecline";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-15T12:00:00Z"); // a Saturday, arbitrary anchor

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY_MS);
}

describe("isDeclining", () => {
  it("flags the book's exact decay pattern — active last week, quiet this week", () => {
    // Last week (days 8-14 ago): studied on 4 distinct days.
    // This week (days 0-6 ago): studied on 1 distinct day.
    const reviewedAt = [
      daysAgo(13),
      daysAgo(11),
      daysAgo(10),
      daysAgo(9),
      daysAgo(2),
    ];
    expect(isDeclining({ reviewedAt, now: NOW })).toBe(true);
  });

  it("does not flag someone who was never really active last week", () => {
    // Only 2 distinct days last week — the "3+" floor isn't met, so a quiet
    // week isn't a *decline*, just... quiet. Nothing to compare against.
    const reviewedAt = [daysAgo(12), daysAgo(9)];
    expect(isDeclining({ reviewedAt, now: NOW })).toBe(false);
  });

  it("does not flag someone still studying normally this week", () => {
    // Last week: 3 distinct days. This week: 3 distinct days too — no decline.
    const reviewedAt = [daysAgo(13), daysAgo(11), daysAgo(9), daysAgo(5), daysAgo(3), daysAgo(1)];
    expect(isDeclining({ reviewedAt, now: NOW })).toBe(false);
  });

  it("does not flag a brand-new user with no history to decline from", () => {
    expect(isDeclining({ reviewedAt: [], now: NOW })).toBe(false);
  });

  it("multiple reviews on the same day count as one study day, not several", () => {
    // 5 reviews on one day last week should NOT satisfy the 3-day floor.
    const sameDayLastWeek = daysAgo(10);
    const reviewedAt = Array.from({ length: 5 }, () => sameDayLastWeek);
    expect(isDeclining({ reviewedAt, now: NOW })).toBe(false);
  });

  it("exactly 2 this week / exactly 3 last week is still a decline (boundary)", () => {
    const reviewedAt = [daysAgo(13), daysAgo(11), daysAgo(9), daysAgo(4), daysAgo(1)];
    expect(isDeclining({ reviewedAt, now: NOW })).toBe(true);
  });
});

describe("weekLabel", () => {
  it("is stable within the same 7-day window", () => {
    const a = weekLabel(NOW);
    const b = weekLabel(new Date(NOW.getTime() + 3 * DAY_MS));
    expect(a).toBe(b);
  });

  it("changes once the window rolls over", () => {
    const a = weekLabel(NOW);
    const b = weekLabel(new Date(NOW.getTime() + 8 * DAY_MS));
    expect(a).not.toBe(b);
  });
});
