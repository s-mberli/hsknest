import { describe, expect, it } from "vitest";
import { practiceWordIdsSchema } from "@/lib/validation";
import { practiceSessionHref } from "@/lib/practiceSession";
import { matchRounds } from "@/lib/matchRounds";

describe("Practice restart and retry", () => {
  it("retains scope, replaces the round limit, and starts a distinct session", () => {
    const href = practiceSessionHref("/study/quiz", new URLSearchParams("listIds=a&languageId=zh&minutes=5"), "fresh", ["b", "b"]);
    expect(href).toBe("/study/quiz?listIds=a&languageId=zh&mode=practice&limit=1&wordIds=b&session=fresh");
  });
  it("falls back to flashcards for a single Match target", () => {
    expect(practiceSessionHref("/study/match", new URLSearchParams(), "fresh", ["b"])).toBe("/study?mode=practice&limit=1&wordIds=b&session=fresh");
  });
  it("keeps an explicit empty selection empty", () => {
    expect(practiceWordIdsSchema.parse("" )).toEqual([]);
  });
  it("rejects malformed and oversized ID selections", () => {
    expect(practiceWordIdsSchema.safeParse("a,,b").success).toBe(false);
    expect(practiceWordIdsSchema.safeParse(Array(501).fill("a").join(",")).success).toBe(false);
  });
  it("keeps every Match target even with a single-word final round", () => {
    expect(matchRounds([1, 2, 3, 4, 5, 6])).toEqual([[1, 2, 3, 4, 5, 6]]);
    expect(matchRounds([1, 2, 3, 4, 5, 6, 7])).toEqual([[1, 2, 3, 4, 5], [6, 7]]);
  });
});
