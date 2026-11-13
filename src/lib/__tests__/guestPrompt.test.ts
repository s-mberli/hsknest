import { describe, expect, it } from "vitest";

import { shouldPromptReturningGuest } from "@/lib/guest";

const now = new Date("2026-11-13T09:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

describe("shouldPromptReturningGuest", () => {
  it("prompts a guest who is a day old and has words due", () => {
    expect(
      shouldPromptReturningGuest({ isGuest: true, createdAt: hoursAgo(24), due: 3, now })
    ).toBe(true);
  });

  it("does not prompt when nothing is due, however old the guest is", () => {
    expect(
      shouldPromptReturningGuest({ isGuest: true, createdAt: hoursAgo(72), due: 0, now })
    ).toBe(false);
  });

  it("does not prompt a guest created late yesterday evening", () => {
    // Created 23:50 the previous calendar day, back at 09:00: under 24 hours.
    expect(
      shouldPromptReturningGuest({
        isGuest: true,
        createdAt: new Date("2026-11-12T23:50:00Z"),
        due: 5,
        now,
      })
    ).toBe(false);
  });

  it("never prompts a saved account", () => {
    expect(
      shouldPromptReturningGuest({ isGuest: false, createdAt: hoursAgo(72), due: 3, now })
    ).toBe(false);
  });

  it("does not prompt without a usable creation date", () => {
    expect(shouldPromptReturningGuest({ isGuest: true, due: 3, now })).toBe(false);
    expect(
      shouldPromptReturningGuest({ isGuest: true, createdAt: "not a date", due: 3, now })
    ).toBe(false);
  });

  it("accepts the ISO string a server component serialises", () => {
    expect(
      shouldPromptReturningGuest({
        isGuest: true,
        createdAt: hoursAgo(30).toISOString(),
        due: 1,
        now,
      })
    ).toBe(true);
  });
});
