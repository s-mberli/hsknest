import { describe, expect, it } from "vitest";

import {
  breaksStreak,
  GRADE_LABELS,
  isPass,
  QUALITY_BY_DIRECTION,
  requeuesInSession,
} from "@/lib/grading";

describe("grading", () => {
  describe("isPass", () => {
    it("Again (1) is not a pass", () => {
      expect(isPass(1)).toBe(false);
    });

    // The bug this module fixes: Hard used to fail in one screen and pass
    // in another. It must always pass.
    it("Hard (3) IS a pass", () => {
      expect(isPass(3)).toBe(true);
    });

    it("Good (4) and Easy (5) are passes", () => {
      expect(isPass(4)).toBe(true);
      expect(isPass(5)).toBe(true);
    });
  });

  describe("breaksStreak", () => {
    it("is the exact inverse of isPass over the domain {1,3,4,5}", () => {
      for (const q of [1, 3, 4, 5]) {
        expect(breaksStreak(q)).toBe(!isPass(q));
      }
    });

    it("only Again (1) breaks the streak", () => {
      expect(breaksStreak(1)).toBe(true);
      expect(breaksStreak(3)).toBe(false);
      expect(breaksStreak(4)).toBe(false);
      expect(breaksStreak(5)).toBe(false);
    });
  });

  describe("requeuesInSession", () => {
    it("Again and Hard requeue; Good and Easy do not", () => {
      expect(requeuesInSession(1)).toBe(true);
      expect(requeuesInSession(3)).toBe(true);
      expect(requeuesInSession(4)).toBe(false);
      expect(requeuesInSession(5)).toBe(false);
    });

    it("is a strictly different threshold from isPass — Hard passes but still requeues", () => {
      expect(isPass(3)).toBe(true);
      expect(requeuesInSession(3)).toBe(true);
    });
  });

  it("QUALITY_BY_DIRECTION covers all four gestures with the canonical mapping", () => {
    expect(QUALITY_BY_DIRECTION).toEqual({ left: 1, down: 3, right: 4, up: 5 });
  });

  it("GRADE_LABELS has one entry per quality value, ordered Again→Hard→Good→Easy", () => {
    expect(GRADE_LABELS.map((g) => g.quality)).toEqual([1, 3, 4, 5]);
    expect(GRADE_LABELS.map((g) => g.label)).toEqual(["Again", "Hard", "Good", "Easy"]);
  });
});
