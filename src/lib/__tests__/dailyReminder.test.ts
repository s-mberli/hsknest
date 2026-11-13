import { describe, expect, it } from "vitest";

import {
  localDateKey,
  reminderKind,
  shouldSendReminder,
  signUnsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from "@/lib/dailyReminder";

describe("shouldSendReminder", () => {
  it("never sends once the user has studied today", () => {
    expect(shouldSendReminder({ dueCount: 40, streakDays: 10, studiedToday: true })).toBe(false);
  });

  it("sends when cards are due, even with no streak", () => {
    expect(shouldSendReminder({ dueCount: 1, streakDays: 0, studiedToday: false })).toBe(true);
  });

  it("sends to protect a streak of 2+ days when nothing is due", () => {
    expect(shouldSendReminder({ dueCount: 0, streakDays: 2, studiedToday: false })).toBe(true);
  });

  it("stays quiet with nothing due and a streak under 2", () => {
    expect(shouldSendReminder({ dueCount: 0, streakDays: 1, studiedToday: false })).toBe(false);
    expect(shouldSendReminder({ dueCount: 0, streakDays: 0, studiedToday: false })).toBe(false);
  });
});

describe("reminder dedup key", () => {
  it("is one key per local calendar day", () => {
    const morning = new Date(2026, 10, 13, 0, 5);
    const night = new Date(2026, 10, 13, 23, 55);
    expect(localDateKey(morning)).toBe("2026-11-13");
    expect(reminderKind(morning)).toBe("daily_reminder:2026-11-13");
    expect(reminderKind(night)).toBe(reminderKind(morning));
    expect(reminderKind(new Date(2026, 10, 14, 0, 0))).toBe("daily_reminder:2026-11-14");
  });
});

describe("unsubscribe token", () => {
  const secret = "test-secret";

  it("verifies a token it signed", () => {
    const t = signUnsubscribeToken("user_1", secret);
    expect(verifyUnsubscribeToken("user_1", t, secret)).toBe(true);
  });

  it("rejects the token for another user", () => {
    const t = signUnsubscribeToken("user_1", secret);
    expect(verifyUnsubscribeToken("user_2", t, secret)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const t = signUnsubscribeToken("user_1", "other-secret");
    expect(verifyUnsubscribeToken("user_1", t, secret)).toBe(false);
  });

  it("rejects tampered, truncated or empty input", () => {
    const t = signUnsubscribeToken("user_1", secret);
    const flipped = (t[0] === "A" ? "B" : "A") + t.slice(1);
    expect(verifyUnsubscribeToken("user_1", flipped, secret)).toBe(false);
    expect(verifyUnsubscribeToken("user_1", t.slice(0, -1), secret)).toBe(false);
    expect(verifyUnsubscribeToken("user_1", "", secret)).toBe(false);
    expect(verifyUnsubscribeToken("", t, secret)).toBe(false);
    expect(verifyUnsubscribeToken("user_1", t, "")).toBe(false);
  });

  it("refuses to sign without a secret", () => {
    expect(() => signUnsubscribeToken("user_1", "")).toThrow();
  });

  it("builds a URL whose params verify", () => {
    const url = new URL(unsubscribeUrl("https://example.test", "user_1", secret));
    expect(url.pathname).toBe("/api/unsubscribe");
    expect(
      verifyUnsubscribeToken(url.searchParams.get("u")!, url.searchParams.get("t")!, secret)
    ).toBe(true);
  });
});
