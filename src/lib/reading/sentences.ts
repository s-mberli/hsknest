/**
 * Reusable helpers for working with hydrated sentence groups.
 * Extracted from ReaderView and hydrate to eliminate duplicated slicing.
 */

import type { HydratedText, StoryToken } from "./types";

/** Return the token slice for a sentence index, bounds-safe. */
export function sentenceTokens(doc: HydratedText, sentIdx: number): StoryToken[] {
  const s = doc.sentences[sentIdx];
  if (!s) return [];
  return doc.tokens.slice(s.t0, Math.min(s.t1, doc.tokens.length));
}

/** Find which sentence index contains the given token (by char offset). */
export function findSentenceForToken(doc: HydratedText, token: StoryToken): number {
  return doc.sentences.findIndex((s, i) => {
    const st = sentenceTokens(doc, i);
    return st.some((t) => t.s === token.s && t.e === token.e);
  });
}

/** Join surface forms of a sentence into a single string. */
export function sentenceSurface(doc: HydratedText, sentIdx: number): string {
  return sentenceTokens(doc, sentIdx).map((t) => t.w).join("");
}

/** Find which sentence contains an audio mark (by char range overlap). */
export function findSentenceForMark(
  doc: HydratedText,
  mark: { s: number; e: number }
): number {
  return doc.sentences.findIndex((s, i) => {
    const st = sentenceTokens(doc, i);
    return st.some((tk) => tk.s >= mark.s && tk.s < mark.e);
  });
}
