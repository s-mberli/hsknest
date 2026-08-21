/**
 * Shared "turn a looked-up word into a flashcard" logic, used by both the
 * single-word add (/api/reading/deck) and the post-read batch add
 * (/api/reading/deck/batch) routes so the two paths can't drift.
 *
 * Also the fix point for two pre-existing quirks in the single-add path:
 * every reading word used to be created with position: 0 (arbitrary
 * intra-list order), and the "From Reading" list never got a ListPriority
 * row, so weightedInterleave (src/lib/listPriority.ts) silently treated it
 * as unranked instead of mixing it in with the user's other studying lists.
 */
import type { Prisma } from "@prisma/client";
import { loadCedict, toneMark } from "@/lib/reading/cedict";

// Minimal shape both `prisma` and a `$transaction` callback's `tx` satisfy —
// avoids importing the full PrismaClient type just for this.
// `tx` is typed `any` below (both the shared `prisma` client and a
// `$transaction` callback's client satisfy it) — Prisma's generated client
// types are structurally awkward to narrow across a shared helper like this
// one, and the callers (single-add and batch-add routes) already exercise
// this path under real integration tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DeckAddTx = any;

export interface DeckAddItem {
  lemma: string;
  pinyin?: string;
  level?: number;
  sentence?: string;
}

export interface ResolvedWordData {
  term: string;
  translation: string;
  phonetic: string;
  position: number;
  metadata?: Prisma.InputJsonValue;
}

/** CEDICT lookup + metadata assembly for one word. No I/O beyond the (cached) dictionary load. */
export function resolveWordData(
  item: DeckAddItem,
  storySlug: string | undefined,
  position: number
): ResolvedWordData {
  let translation = item.lemma;
  let phonetic = item.pinyin ?? "";
  let meanings: string[] = [];
  try {
    const dict = loadCedict();
    const entry = dict[item.lemma];
    if (entry && entry[0]) {
      translation = entry[0][1]?.[0] ?? item.lemma;
      meanings = entry[0][1] ?? [];
      if (!phonetic) phonetic = toneMark(entry[0][0] ?? "");
    }
  } catch {
    // CEDICT unavailable — fall back to the lemma itself as translation.
  }

  const metadata: Record<string, unknown> = {};
  if (item.level) metadata.hskLevel = item.level;
  if (meanings.length > 0) metadata.meanings = meanings;
  if (item.sentence) metadata.encounterSentence = item.sentence;
  if (storySlug) metadata.encounterSource = storySlug;

  return {
    term: item.lemma,
    translation,
    phonetic,
    position,
    metadata: Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : undefined,
  };
}

/**
 * Find-or-create the user's "From Reading" list for a language, and make
 * sure it has a ListPriority row (appended after their other studying
 * lists, not inserted at the top) so the queue mixes it in instead of
 * treating it as unranked. Returns the current word count so callers can
 * assign increasing `position` values instead of always 0.
 */
export async function ensureReadingList(
  tx: DeckAddTx,
  userId: string,
  languageId: string
): Promise<{ id: string; wordCount: number }> {
  let list = await tx.wordList.findFirst({
    where: { createdById: userId, languageId, name: "From Reading" },
    include: { _count: { select: { words: true } } },
  });
  if (!list) {
    list = await tx.wordList.create({
      data: { name: "From Reading", languageId, createdById: userId },
      include: { _count: { select: { words: true } } },
    });
  }

  const priority = await tx.listPriority.findUnique({
    where: { userId_wordListId: { userId, wordListId: list.id } },
  });
  if (!priority) {
    const maxRank = await tx.listPriority.aggregate({
      where: { userId },
      _max: { rank: true },
    });
    await tx.listPriority.create({
      data: { userId, wordListId: list.id, rank: (maxRank._max.rank ?? -1) + 1 },
    });
  }

  return { id: list.id, wordCount: list._count.words };
}
