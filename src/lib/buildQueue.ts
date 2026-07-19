import { prisma } from "@/lib/prisma";

export interface QueueCard {
  wordId: string;
  term: string;
  translation: string;
  phonetic: string | null;
  metadata: unknown;
  state: string;
  kind: "review" | "check" | "new" | "practice";
  languageCode: string;
  lapses: number;
  choices?: string[];
  sentence?: {
    text: string;
    translation: string;
    phonetic: string | null;
    source: string | null;
  };
}

interface ProgressRowMinimal {
  wordId: string;
  state: string;
  lapses: number;
  word: {
    term: string;
    translation: string;
    phonetic: string | null;
    metadata: unknown;
    wordList: { language: { code: string } };
  };
}

export async function computeDailyCaps(
  userId: string,
  dayStart: Date,
  capLangFilter: Record<string, unknown>
): Promise<{ newIntroducedToday: number; assumedCheckedToday: number }> {
  const [newIntroducedToday, assumedCheckedToday] = await Promise.all([
    prisma.userProgress.count({
      where: {
        userId,
        introducedAt: { gte: dayStart },
        state: { notIn: ["ASSUMED"] },
        ...capLangFilter,
      },
    }),
    prisma.userProgress.count({
      where: { userId, assumedCheckedAt: { gte: dayStart }, ...capLangFilter },
    }),
  ]);
  return { newIntroducedToday, assumedCheckedToday };
}

export function toCards<T extends ProgressRowMinimal>(
  rows: T[],
  kind: QueueCard["kind"]
): QueueCard[] {
  return rows.map((p) => ({
    wordId: p.wordId,
    term: p.word.term,
    translation: p.word.translation,
    phonetic: p.word.phonetic,
    metadata: p.word.metadata,
    state: p.state,
    kind,
    languageCode: p.word.wordList.language.code,
    lapses: p.lapses,
  }));
}
