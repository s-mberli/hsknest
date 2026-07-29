/**
 * Character style preference — whether to display Chinese characters in a
 * modern (sans-serif, Hei/黑体) or academic (serif, Song/宋体) style.
 *
 * The OS font stack automatically supplies the correct native Chinese font:
 * - font-sans: Hei (clean, digital, everyday apps)
 * - font-serif: Song/Ming (print, textbooks, HSK exam paper)
 *
 * Applied only to the flashcard term (the big Chinese character).
 * Reading (pinyin) and meaning (English) are unaffected.
 */

export type CharacterStyle = "modern" | "academic";

export const CHARACTER_STYLE_CLASS: Record<CharacterStyle, string> = {
  modern: "font-sans",
  academic: "font-serif",
};

export function normalizeCharacterStyle(value: unknown): CharacterStyle {
  return value === "academic" ? "academic" : "modern";
}
