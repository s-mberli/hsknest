/**
 * Homophone group management: build groups from word list, pick waves for tone discrimination.
 *
 * A homophone group is a set of single-character words that sound identical (same
 * tone-less pronunciation), differing only by tone. Used for tone-discrimination waves:
 * "Slice every 3rd tone in [jiàn]" where all 5 tiles sound like "jian" but have
 * different tones.
 *
 * Groups are built only from single-character words to keep prompts unambiguous.
 */

import { tonelessPhonetic, toneOf, syllables, stripTone } from "./pinyin";
import type { NinjaWord } from "./distractors";

export interface HomophoneGroup {
  toneless: string; // e.g. "jian"
  members: NinjaWord[]; // words with this pronunciation
  byTone: Record<number, NinjaWord[]>; // grouped by tone (1–5)
}

/**
 * Build homophone groups from word list.
 * Only includes single-character words with ≥4 members in a group.
 * Returns a map: toneless → HomophoneGroup.
 */
export function buildHomophoneGroups(words: NinjaWord[]): Map<string, HomophoneGroup> {
  const groups = new Map<string, NinjaWord[]>();

  for (const word of words) {
    // Only single-character words
    if (word.term.length !== 1) continue;
    if (!word.term.match(/^[一-鿿]$/)) continue;

    // Get toneless phonetic (first syllable only, since single-char)
    const phonetic = word.phonetic || "";
    if (!phonetic) continue;

    const toneless = stripTone(syllables(phonetic)[0] || "");
    if (!toneless) continue;

    if (!groups.has(toneless)) {
      groups.set(toneless, []);
    }
    groups.get(toneless)!.push(word);
  }

  // Filter to groups with ≥4 members, build structured groups
  const result = new Map<string, HomophoneGroup>();
  for (const [toneless, members] of groups) {
    if (members.length < 4) continue;

    // Group by tone
    const byTone: Record<number, NinjaWord[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const word of members) {
      const phonetic = word.phonetic || "";
      const firstSyllable = syllables(phonetic)[0] || "";
      const tone = toneOf(firstSyllable);
      byTone[tone].push(word);
    }

    result.set(toneless, { toneless, members, byTone });
  }

  return result;
}

/**
 * Pick a wave of tiles for tone discrimination within a homophone group.
 * Selects tiles from a specified tone or all tones except a specified one.
 * Returns up to `size` tiles; fills with members if needed.
 *
 * @param group – HomophoneGroup
 * @param targetTone – tone 1–5 to include (or exclude if excludeTone=true)
 * @param excludeTone – if true, pick from all tones EXCEPT targetTone
 * @param size – number of tiles to return
 * @param rng – seeded RNG
 * @returns array of words, length ≤ size
 */
export function pickHomophoneWave(
  group: HomophoneGroup,
  targetTone: 1 | 2 | 3 | 4 | 5,
  excludeTone: boolean,
  size: number,
  rng: () => number
): NinjaWord[] {
  let candidates: NinjaWord[] = [];

  if (excludeTone) {
    // Pick from all tones EXCEPT targetTone
    for (let t = 1; t <= 5; t++) {
      if (t !== targetTone) {
        candidates.push(...group.byTone[t]);
      }
    }
  } else {
    // Pick from targetTone only
    candidates = [...group.byTone[targetTone]];
  }

  if (candidates.length === 0) {
    return [];
  }

  // Shuffle and take first `size`
  const shuffled = [...candidates].sort(() => rng() - 0.5);
  return shuffled.slice(0, size);
}

/**
 * Get a prompt string for a homophone tone-discrimination wave.
 * @example getHomophonePrompt("jian", 3, false) → "jiàn — slice every 3rd tone"
 */
export function getHomophonePrompt(
  toneless: string,
  targetTone: 1 | 2 | 3 | 4 | 5,
  excludeTone: boolean
): string {
  const toneNames = ["1st tone", "2nd tone", "3rd tone", "4th tone", "neutral tone"];
  const toneName = toneNames[targetTone - 1];
  const action = excludeTone ? `slice every tone EXCEPT ${toneName}` : `slice every ${toneName}`;
  return `${toneless} — ${action}`;
}
