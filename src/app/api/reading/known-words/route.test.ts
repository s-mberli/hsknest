import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { userProgress: { findMany } } }));
vi.mock("@/lib/session", () => ({ getCurrentUserId: async () => "reader" }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: () => true }));

const { GET } = await import("./route");

describe("reading known words", () => {
  beforeEach(() => findMany.mockReset());

  it("keeps NEW deck membership separate from learned hint eligibility", async () => {
    findMany.mockResolvedValue([
      { word: { term: "new" }, state: "NEW", intervalDays: 0, lapses: 0 },
      { word: { term: "learning" }, state: "LEARNING", intervalDays: 0, lapses: 0 },
      { word: { term: "review" }, state: "REVIEW", intervalDays: 5, lapses: 0 },
      { word: { term: "lapsed" }, state: "LAPSED", intervalDays: 1, lapses: 1 },
      { word: { term: "mastered" }, state: "MASTERED", intervalDays: 30, lapses: 0 },
      { word: { term: "assumed" }, state: "ASSUMED", intervalDays: 0, lapses: 0 },
      { word: { term: "learning" }, state: "NEW", intervalDays: 0, lapses: 0 },
    ]);
    const response = await GET();
    expect(response.status).toBe(200);
    const { known } = await response.json();
    expect(known).toHaveLength(6);
    expect(Object.fromEntries(known.map((row: { lemma: string; learned: boolean }) => [row.lemma, row.learned]))).toEqual({
      new: false, learning: true, review: true, lapsed: true, mastered: true, assumed: true,
    });
  });
});
