import { describe, expect, it } from "vitest";

import { buildChoices } from "@/lib/quizChoices";

describe("buildChoices", () => {
  const pool = ["a", "b", "c", "d", "e", "f"];

  it("returns 4 options with a large pool", () => {
    expect(buildChoices("correct", pool)).toHaveLength(4);
  });

  it("always includes the correct answer exactly once", () => {
    for (let i = 0; i < 50; i++) {
      const opts = buildChoices("correct", pool);
      expect(opts.filter((o) => o === "correct")).toHaveLength(1);
    }
  });

  it("never repeats a distractor and never uses the correct value as one", () => {
    const opts = buildChoices("correct", ["x", "x", "correct", "y"]);
    expect(new Set(opts).size).toBe(opts.length);
    expect(opts).toContain("correct");
  });

  it("degrades to fewer than 4 with a small pool", () => {
    expect(buildChoices("correct", ["x"])).toEqual(
      expect.arrayContaining(["correct", "x"])
    );
    expect(buildChoices("correct", ["x"])).toHaveLength(2);
    expect(buildChoices("correct", [])).toEqual(["correct"]);
  });

  it("ignores empty-string pool entries", () => {
    const opts = buildChoices("correct", ["", "", "y"]);
    expect(opts).not.toContain("");
    expect(opts).toEqual(expect.arrayContaining(["correct", "y"]));
  });

  it("varies the order across runs", () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 40; i++) firsts.add(buildChoices("correct", pool)[0]);
    // With shuffling, the first slot should not be constant.
    expect(firsts.size).toBeGreaterThan(1);
  });
});
