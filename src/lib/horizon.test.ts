import { describe, expect, it } from "vitest";
import {
  HORIZON_ORDER,
  isDueNow,
  matches,
  relativeDueLabel,
  wordHorizon,
} from "./horizon";

const NOW = new Date("2026-01-01T00:00:00.000Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

function iso(offsetDays: number): string {
  return new Date(NOW + offsetDays * DAY_MS).toISOString();
}

describe("wordHorizon", () => {
  it("buckets ASSUMED and MASTERED as resting regardless of dueAt", () => {
    expect(wordHorizon({ state: "ASSUMED", dueAt: iso(-5) }, NOW)).toBe("resting");
    expect(wordHorizon({ state: "MASTERED", dueAt: null }, NOW)).toBe("resting");
  });

  it("buckets NEW as new regardless of dueAt", () => {
    expect(wordHorizon({ state: "NEW", dueAt: null }, NOW)).toBe("new");
    expect(wordHorizon({ state: "NEW", dueAt: iso(100) }, NOW)).toBe("new");
  });

  it("buckets overdue and due-now as due", () => {
    expect(wordHorizon({ state: "REVIEW", dueAt: iso(-1) }, NOW)).toBe("due");
    expect(wordHorizon({ state: "REVIEW", dueAt: iso(0) }, NOW)).toBe("due");
  });

  it("buckets missing or NaN dueAt as due (surface anomalies)", () => {
    expect(wordHorizon({ state: "REVIEW", dueAt: null }, NOW)).toBe("due");
    expect(wordHorizon({ state: "LEARNING", dueAt: "not-a-date" }, NOW)).toBe("due");
  });

  it("boundary: +6 and +7 days are 'week', +8 days is 'month'", () => {
    expect(wordHorizon({ state: "LEARNING", dueAt: iso(6) }, NOW)).toBe("week");
    expect(wordHorizon({ state: "LEARNING", dueAt: iso(7) }, NOW)).toBe("week");
    expect(wordHorizon({ state: "LEARNING", dueAt: iso(8) }, NOW)).toBe("month");
  });

  it("boundary: +29 days is 'month', +31 days is 'later'", () => {
    expect(wordHorizon({ state: "REVIEW", dueAt: iso(29) }, NOW)).toBe("month");
    expect(wordHorizon({ state: "REVIEW", dueAt: iso(30) }, NOW)).toBe("month");
    expect(wordHorizon({ state: "REVIEW", dueAt: iso(31) }, NOW)).toBe("later");
  });

  it("applies the same bucketing to LAPSED state", () => {
    expect(wordHorizon({ state: "LAPSED", dueAt: iso(-2) }, NOW)).toBe("due");
    expect(wordHorizon({ state: "LAPSED", dueAt: iso(100) }, NOW)).toBe("later");
  });

  it("HORIZON_ORDER has all six lanes in the documented order", () => {
    expect(HORIZON_ORDER).toEqual(["due", "week", "month", "later", "new", "resting"]);
  });
});

describe("isDueNow", () => {
  it("is true for LEARNING/REVIEW/LAPSED with dueAt in the past or now", () => {
    expect(isDueNow({ state: "REVIEW", dueAt: iso(0) }, NOW)).toBe(true);
    expect(isDueNow({ state: "LEARNING", dueAt: iso(-1) }, NOW)).toBe(true);
    expect(isDueNow({ state: "LAPSED", dueAt: iso(-1) }, NOW)).toBe(true);
  });

  it("is false for NEW/ASSUMED/MASTERED even with a past dueAt", () => {
    expect(isDueNow({ state: "NEW", dueAt: iso(-1) }, NOW)).toBe(false);
    expect(isDueNow({ state: "ASSUMED", dueAt: iso(-1) }, NOW)).toBe(false);
    expect(isDueNow({ state: "MASTERED", dueAt: iso(-1) }, NOW)).toBe(false);
  });

  it("is false when dueAt is missing or in the future", () => {
    expect(isDueNow({ state: "REVIEW", dueAt: null }, NOW)).toBe(false);
    expect(isDueNow({ state: "REVIEW", dueAt: iso(1) }, NOW)).toBe(false);
  });
});

describe("matches", () => {
  const word = {
    term: "学习",
    phonetic: "xué xí",
    translation: "to study",
    metadata: { meanings: [{ gloss: "to learn" }] },
  };

  it("matches pinyin without tone marks, spaces, or apostrophes", () => {
    expect(matches(word, "xuexi")).toBe(true);
    expect(matches(word, "xue xi")).toBe(true);
    expect(matches({ ...word, phonetic: "nǚ'ér" }, "nver")).toBe(true);
  });

  it("accepts v and u: as ü input without making plain u ambiguous", () => {
    const lǜ = { ...word, phonetic: "lǜ" };
    expect(matches(lǜ, "lv")).toBe(true);
    expect(matches(lǜ, "lu:")).toBe(true);
    expect(matches(lǜ, "lu")).toBe(false);
  });

  it("retains Hanzi, English, alternate-meaning, and empty-search behavior", () => {
    expect(matches(word, "学习")).toBe(true);
    expect(matches(word, "study")).toBe(true);
    expect(matches(word, "learn")).toBe(true);
    expect(matches(word, "")).toBe(true);
    expect(matches(word, "   ")).toBe(true);
  });
});

describe("relativeDueLabel", () => {
  it("uses one supplied snapshot for overdue, due-now, today, tomorrow, and later dates", () => {
    const snapshotDate = new Date(2026, 0, 1, 12);
    const snapshot = snapshotDate.getTime();
    const sameDay = new Date(snapshotDate);
    sameDay.setHours(18);
    const tomorrow = new Date(snapshotDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const later = new Date(snapshotDate);
    later.setDate(later.getDate() + 2);

    expect(relativeDueLabel(new Date(snapshot - 1), undefined, snapshot)).toBe(
      "Overdue"
    );
    expect(relativeDueLabel(new Date(snapshot), undefined, snapshot)).toBe(
      "Due now"
    );
    expect(relativeDueLabel(sameDay, undefined, snapshot)).toBe(
      "Today"
    );
    expect(relativeDueLabel(tomorrow, undefined, snapshot)).toBe(
      "Tomorrow"
    );
    expect(relativeDueLabel(later, undefined, snapshot)).toBe(
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(later)
    );
  });
});
