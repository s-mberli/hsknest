/**
 * Reading Mode text-size ladder, a per-browser preference (`localStorage`,
 * see `ReaderSettings.tsx`'s `Prefs`) — not a `User` column, unlike the
 * study-card equivalent in `src/lib/textSize.ts`.
 *
 * Single owner of the ladder on purpose: it used to live as two independent
 * hardcoded copies (a `FONT_SIZES` array driving the header −/+ buttons in
 * `ReaderView.tsx`, and separate `min`/`max` bounds on the free-drag slider
 * in `ReaderSettings.tsx`). They drifted — the slider could produce a value
 * the button ladder didn't contain, so `indexOf` returned -1 and the next
 * button press silently jumped to the wrong end of the range. Addressing the
 * ladder by index (`readerFontSizeIndex`) rather than by raw px makes that
 * class of bug unrepresentable.
 */

export const READER_FONT_SIZES = [25, 28, 31, 35, 39, 44] as const;

export const DEFAULT_READER_FONT_SIZE: (typeof READER_FONT_SIZES)[number] = 31;

/**
 * Snaps any input to the nearest ladder rung. Used both for the settings
 * slider (which now addresses the ladder by index, so this is the reverse
 * lookup) and to migrate a value stored under the old 16-28 range: every
 * old value resolves to >= 25, the new floor, with no explicit reset step.
 */
export function snapReaderFontSize(value: unknown): number {
  // Number(null) === 0 and Number("") === 0, both finite — guard explicitly
  // rather than falling through to a false-finite match on empty/nullish input.
  if (typeof value !== "number" && typeof value !== "string") return DEFAULT_READER_FONT_SIZE;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_READER_FONT_SIZE;
  return READER_FONT_SIZES.reduce((closest, rung) =>
    Math.abs(rung - n) < Math.abs(closest - n) ? rung : closest
  );
}

/** Index of the ladder rung nearest `value`, clamped to a valid index. */
export function readerFontSizeIndex(value: number): number {
  const snapped = snapReaderFontSize(value);
  return READER_FONT_SIZES.indexOf(snapped as (typeof READER_FONT_SIZES)[number]);
}
