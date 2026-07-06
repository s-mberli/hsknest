import { describe, expect, it } from "vitest";

import {
  SHAKY_LAPSES,
  SOLID_INTERVAL_DAYS,
  type Strength,
  STRENGTH_META,
  wordStrength,
} from "../strength";

interface Case {
  name: string;
  state: string;
  intervalDays: number;
  lapses: number;
  expected: Strength;
}

const cases: Case[] = [
  // Direct state mappings
  { name: "MASTERED → mastered", state: "MASTERED", intervalDays: 0, lapses: 0, expected: "mastered" },
  { name: "ASSUMED → known", state: "ASSUMED", intervalDays: 0, lapses: 0, expected: "known" },
  { name: "NEW → new", state: "NEW", intervalDays: 0, lapses: 0, expected: "new" },

  // Shaky by state / by lapses
  { name: "LAPSED → shaky", state: "LAPSED", intervalDays: 5, lapses: 0, expected: "shaky" },
  { name: "REVIEW with lapses>=3 → shaky", state: "REVIEW", intervalDays: 30, lapses: 3, expected: "shaky" },
  { name: "LEARNING with lapses>=3 → shaky", state: "LEARNING", intervalDays: 1, lapses: 4, expected: "shaky" },

  // Solid vs growing boundary at interval 21
  { name: "REVIEW interval==21 → solid", state: "REVIEW", intervalDays: SOLID_INTERVAL_DAYS, lapses: 0, expected: "solid" },
  { name: "REVIEW interval>21 → solid", state: "REVIEW", intervalDays: 100, lapses: 2, expected: "solid" },
  { name: "REVIEW interval==20 → growing", state: "REVIEW", intervalDays: 20, lapses: 0, expected: "growing" },

  // Growing catch-all
  { name: "LEARNING → growing", state: "LEARNING", intervalDays: 0, lapses: 0, expected: "growing" },
  { name: "young REVIEW → growing", state: "REVIEW", intervalDays: 3, lapses: 1, expected: "growing" },

  // Lapses boundary (2 stays, 3 flips)
  { name: "lapses==2 stays growing", state: "REVIEW", intervalDays: 5, lapses: SHAKY_LAPSES - 1, expected: "growing" },
];

describe("wordStrength", () => {
  it.each(cases)("$name", ({ state, intervalDays, lapses, expected }) => {
    expect(wordStrength({ state, intervalDays, lapses })).toBe(expected);
  });

  it("precedence: shaky (lapses) overrides solid interval", () => {
    expect(
      wordStrength({ state: "REVIEW", intervalDays: 100, lapses: 5 })
    ).toBe("shaky");
  });
});

describe("STRENGTH_META", () => {
  it("has label + blurb for every band", () => {
    const bands: Strength[] = [
      "mastered",
      "solid",
      "growing",
      "shaky",
      "known",
      "new",
    ];
    for (const b of bands) {
      expect(STRENGTH_META[b].label.length).toBeGreaterThan(0);
      expect(STRENGTH_META[b].blurb.length).toBeGreaterThan(0);
    }
  });
});
