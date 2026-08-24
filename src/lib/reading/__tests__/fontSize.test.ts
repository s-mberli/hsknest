import { describe, expect, it } from "vitest";

import {
  DEFAULT_READER_FONT_SIZE,
  READER_FONT_SIZES,
  readerFontSizeIndex,
  snapReaderFontSize,
} from "../fontSize";

/**
 * Regression guard for the reader's −/+ buttons and settings slider
 * disagreeing: the old design was two independent hardcoded copies (a
 * `FONT_SIZES` button ladder and separate slider min/max), so a slider value
 * outside the button ladder made `indexOf` return -1 and the next button
 * press jump to the wrong end. Addressing the ladder only by index, snapped
 * from any raw value, makes that unrepresentable.
 */

describe("READER_FONT_SIZES / DEFAULT_READER_FONT_SIZE", () => {
  it("the default is itself a rung on the ladder", () => {
    expect(READER_FONT_SIZES).toContain(DEFAULT_READER_FONT_SIZE);
  });

  it("the new floor is 25 — today's old maximum", () => {
    expect(Math.min(...READER_FONT_SIZES)).toBe(25);
  });
});

describe("snapReaderFontSize", () => {
  it("maps every value from the old 16-28 range to >= 25 (the migration guarantee)", () => {
    for (let v = 16; v <= 28; v++) {
      expect(snapReaderFontSize(v)).toBeGreaterThanOrEqual(25);
      expect(READER_FONT_SIZES).toContain(snapReaderFontSize(v));
    }
  });

  it("every ladder rung snaps to itself", () => {
    for (const rung of READER_FONT_SIZES) {
      expect(snapReaderFontSize(rung)).toBe(rung);
    }
  });

  it("falls back to the default for missing or malformed input", () => {
    expect(snapReaderFontSize(undefined)).toBe(DEFAULT_READER_FONT_SIZE);
    expect(snapReaderFontSize(null)).toBe(DEFAULT_READER_FONT_SIZE);
    expect(snapReaderFontSize(NaN)).toBe(DEFAULT_READER_FONT_SIZE);
    expect(snapReaderFontSize("not a number")).toBe(DEFAULT_READER_FONT_SIZE);
  });

  it("snaps to the nearer rung when equidistant is not the case", () => {
    // 33 is 2 away from 31 and 2 away from 35 -> tie goes to the first found
    // (31, since reduce scans left-to-right and only replaces on strictly-less).
    expect(snapReaderFontSize(33)).toBe(31);
    expect(snapReaderFontSize(41)).toBe(39); // closer to 39 than 44
  });
});

describe("readerFontSizeIndex", () => {
  it("round-trips every rung through its index", () => {
    READER_FONT_SIZES.forEach((rung, i) => {
      expect(readerFontSizeIndex(rung)).toBe(i);
      expect(READER_FONT_SIZES[readerFontSizeIndex(rung)]).toBe(rung);
    });
  });

  it("never returns -1 for an out-of-ladder value (the original bug)", () => {
    expect(readerFontSizeIndex(21)).toBeGreaterThanOrEqual(0);
    expect(readerFontSizeIndex(999)).toBeGreaterThanOrEqual(0);
    expect(readerFontSizeIndex(0)).toBeGreaterThanOrEqual(0);
  });

  it("stepping down from the first rung and up from the last rung clamps", () => {
    const firstIdx = readerFontSizeIndex(READER_FONT_SIZES[0]);
    const lastIdx = readerFontSizeIndex(READER_FONT_SIZES[READER_FONT_SIZES.length - 1]);
    expect(READER_FONT_SIZES[Math.max(0, firstIdx - 1)]).toBe(READER_FONT_SIZES[0]);
    expect(READER_FONT_SIZES[Math.min(READER_FONT_SIZES.length - 1, lastIdx + 1)]).toBe(
      READER_FONT_SIZES[READER_FONT_SIZES.length - 1]
    );
  });
});
