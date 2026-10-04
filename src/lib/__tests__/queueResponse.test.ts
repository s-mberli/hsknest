import { describe, expect, it } from "vitest";
import { queueResponseSchema } from "@/lib/queueResponse";

const counts = { due: 0, newAllowedToday: 0, checksAllowedToday: 0 };
describe("queue response contract", () => {
  it("accepts an honest empty queue and retry omissions", () => {
    expect(queueResponseSchema.parse({ cards: [], counts, retryOmitted: 2 }).retryOmitted).toBe(2);
  });
  it("rejects missing or malformed cards instead of treating them as empty", () => {
    expect(queueResponseSchema.safeParse({ counts }).success).toBe(false);
    expect(queueResponseSchema.safeParse({ cards: "empty", counts }).success).toBe(false);
    expect(queueResponseSchema.safeParse({ cards: [{ wordId: "a" }], counts }).success).toBe(false);
  });
  it("accepts a complete card and supplies a missing optional sentence reading", () => {
    const card = { wordId: "a", term: "A", translation: "first", phonetic: null, metadata: null, state: "REVIEW",
      sentence: { text: "A is first", translation: "A is first", source: null } };
    expect(queueResponseSchema.parse({ cards: [card], counts }).cards[0].sentence?.phonetic).toBeNull();
  });
});
