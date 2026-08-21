/**
 * Hydration: build the render-ready document stored in
 * `ReadingText.bodyHydrated`. Runs once at ingest (see scripts/ingest-story.ts)
 * so the reader client does zero NLP work.
 */

import { gradeTokens } from "./grade";
import { segmentText } from "./segment";
import type { CedictData } from "./cedict";
import type { HskLexicon } from "./lexicon";
import type { GradeReport, HydratedText } from "./types";

export function hydrateText(
  body: string,
  lexicon: HskLexicon,
  cedict: CedictData | null,
  targetLevel: number,
  sentenceEn?: string[],
  now: Date = new Date()
): { hydrated: HydratedText; report: GradeReport } {
  const { tokens, sentences } = segmentText(body, { lexicon, cedict });

  // Attach English translations to sentences by PARAGRAPH position.
  // paragraphsEn comes from the frontmatter (one entry per blank-line paragraph).
  // sentences come from the segmenter (splits on 。!?\n). Match by char offset:
  // each paragraph's char range covers a subset of the segmenter's sentence groups.
  if (sentenceEn && sentenceEn.length > 0) {
    // Split body into paragraphs by blank lines
    const paragraphs = body.split(/\n\s*\n/);
    let paraStart = 0;
    for (let pi = 0; pi < paragraphs.length && pi < sentenceEn.length; pi++) {
      const paraBody = paragraphs[pi];
      const paraEnd = paraStart + paraBody.length;
      // Find the first sentence group that falls within this paragraph's char range
      for (const sent of sentences) {
        if (sent.en) continue; // already assigned
        const sentTokens = tokens.slice(sent.t0, Math.min(sent.t1, tokens.length));
        if (sentTokens.length === 0) continue;
        const sentStart = sentTokens[0].s;
        if (sentStart >= paraStart && sentStart < paraEnd) {
          sent.en = sentenceEn[pi];
          break; // assign translation to first sentence in paragraph only
        }
      }
      paraStart = paraEnd + 2; // +2 for the \n\n separator
    }
  }

  const report = gradeTokens(tokens, targetLevel, now);
  const words = tokens.filter((t) => !t.isPunct);
  const hydrated: HydratedText = {
    v: 1,
    chars: Array.from(body).length,
    tokens,
    sentences,
    words: {
      total: words.length,
      unique: new Set(words.map((t) => t.w)).size,
    },
  };
  return { hydrated, report };
}
