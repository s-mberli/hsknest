import { describe, expect, it } from "vitest";
import { heatmapWeeks } from "../heatmapDates";
import { directProgressCount } from "../listMembership";
import { mergeNinjaRecords, parseNinjaRecords } from "../ninja/records";

describe("current-week heatmap", () => {
  it.each([
    ["2026-10-05", 0], ["2026-10-06", 1], ["2026-10-07", 2],
    ["2026-10-08", 3], ["2026-10-09", 4], ["2026-10-10", 5],
    ["2026-10-11", 6],
  ])("includes %s in the final Monday-aligned week", (today, index) => {
    const week = heatmapWeeks(today, 4).at(-1)!;
    expect(week[0]).toBe("2026-10-05");
    expect(week[index]).toBe(today);
    expect(week[6]).toBe("2026-10-11");
  });

  it("keeps the newest week at a narrow width and across year end", () => {
    const weeks = heatmapWeeks("2026-01-01", 4);
    expect(weeks).toHaveLength(4);
    expect(weeks.at(-1)).toEqual([
      "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01",
      "2026-01-02", "2026-01-03", "2026-01-04",
    ]);
  });
});

describe("list removal membership", () => {
  it("counts only progress directly owned by the list", () => {
    expect(directProgressCount(["b1", "b2"], ["a1", "a2"])).toBe(0);
    expect(directProgressCount(["b1", "b2"], ["a1", "b2"])).toBe(1);
    expect(directProgressCount(["b1", "b2"], ["b1", "b2"])).toBe(2);
  });
});

describe("Ninja records", () => {
  it("merges score, combo and waves independently", () => {
    const previous = { score: 500, combo: 8, waves: 12 };
    expect(mergeNinjaRecords(previous, { score: 600, combo: 9, waves: 7 }))
      .toEqual({ score: 600, combo: 9, waves: 12 });
    expect(mergeNinjaRecords(previous, { score: 300, combo: 4, waves: 15 }))
      .toEqual({ score: 500, combo: 8, waves: 15 });
    expect(mergeNinjaRecords(previous, previous)).toEqual(previous);
  });

  it("accepts older records and discards malformed metrics", () => {
    expect(parseNinjaRecords({ score: 40, combo: 2 }))
      .toEqual({ score: 40, combo: 2, waves: 0 });
    expect(parseNinjaRecords({ score: -1, combo: "9", waves: Infinity }))
      .toEqual({ score: 0, combo: 0, waves: 0 });
    expect(parseNinjaRecords("broken")).toBeNull();
  });
});
