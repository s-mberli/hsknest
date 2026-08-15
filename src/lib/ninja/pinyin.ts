/**
 * Pinyin utilities: extract syllables, identify tones, strip marks.
 *
 * Tone marks are NFD combining characters:
 * - U+0304 (macron, ‾) → tone 1 (flat)
 * - U+0301 (acute, ´) → tone 2 (rising)
 * - U+030C (caron, ˇ) → tone 3 (low)
 * - U+0300 (grave, `) → tone 4 (falling)
 * - (none) → tone 5 (neutral)
 *
 * Special case: preserve U+0308 (diaeresis, ¨) for ü vowel (e.g., ǖ = ü + macron).
 */

/**
 * Split phonetic string into syllables on spaces.
 * @example syllables("wǒ men") → ["wǒ", "men"]
 */
export function syllables(phonetic: string): string[] {
  return phonetic.split(" ").filter((s) => s.length > 0);
}

/**
 * Extract tone number (1–5) from a syllable.
 * Normalizes to NFD, checks for combining marks, defaults to tone 5 (neutral).
 * @example toneOf("wǒ") → 3
 * @example toneOf("men") → 5
 */
export function toneOf(syllable: string): 1 | 2 | 3 | 4 | 5 {
  const nfd = syllable.normalize("NFD");

  for (const char of nfd) {
    const code = char.charCodeAt(0);
    if (code === 0x0304) return 1; // macron
    if (code === 0x0301) return 2; // acute
    if (code === 0x030c) return 3; // caron
    if (code === 0x0300) return 4; // grave
  }

  return 5; // neutral tone
}

/**
 * Remove tone marks from a syllable, preserving the ü diaeresis (U+0308).
 * @example stripTone("wǒ") → "wo"
 * @example stripTone("lǜ") → "lü"
 */
export function stripTone(syllable: string): string {
  const nfd = syllable.normalize("NFD");
  const result: string[] = [];

  for (const char of nfd) {
    const code = char.charCodeAt(0);
    // Tone marks: remove
    if (code === 0x0304 || code === 0x0301 || code === 0x030c || code === 0x0300) {
      continue;
    }
    // Diaeresis: keep (for ü)
    if (code === 0x0308) {
      result.push(char);
      continue;
    }
    // Base character: keep
    result.push(char);
  }

  return result.join("").normalize("NFC");
}

/**
 * Return the tone mark character for a tone number (for UI display).
 * Returns combining character in NFD form, to be combined with a vowel.
 * Tone 5 (neutral) returns empty string.
 * @example toneMark(1) → "̄" (macron)
 * @example toneMark(5) → ""
 */
export function toneMark(tone: 1 | 2 | 3 | 4 | 5): string {
  switch (tone) {
    case 1:
      return "̄"; // macron
    case 2:
      return "́"; // acute
    case 3:
      return "̌"; // caron
    case 4:
      return "̀"; // grave
    case 5:
      return ""; // neutral
  }
}

/**
 * Extract tone-less form of a phonetic (space-separated syllables).
 * Useful for grouping homophones by pronunciation without tone.
 * @example tonelessPhonetic("wǒ men") → "wo men"
 */
export function tonelessPhonetic(phonetic: string): string {
  return syllables(phonetic).map(stripTone).join(" ");
}
