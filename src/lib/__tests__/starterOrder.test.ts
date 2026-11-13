import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { weightedInterleave } from "@/lib/listPriority";
import {
  HSK1_STARTER_LIST_NAME,
  HSK1_STARTER_TERMS,
  withStarterOrder,
} from "@/lib/starterOrder";

const hsk1Terms: string[] = (
  JSON.parse(
    readFileSync(join(process.cwd(), "prisma/data/hsk/new1.json"), "utf-8")
  ) as { term: string }[]
).map((w) => w.term);

interface Row {
  wordId: string;
  state: string;
  word: {
    term: string;
    position: number;
    wordListId: string;
    wordList: { name: string; createdById: string | null };
  };
}

function listRows(
  terms: string[],
  listId = "hsk1",
  name = HSK1_STARTER_LIST_NAME,
  createdById: string | null = null
): Row[] {
  return terms.map((term, position) => ({
    wordId: `${listId}-${position}`,
    state: "NEW",
    word: { term, position, wordListId: listId, wordList: { name, createdById } },
  }));
}

/**
 * Mirrors the queue route's "new cards" step for rows that are still NEW:
 * a position-ordered window, plus the starter rows fetched separately.
 */
function nextNewTerms(newRows: Row[], take: number, ranks = new Map<string, number>()) {
  const window = newRows
    .slice()
    .sort((a, b) => a.word.position - b.word.position)
    .slice(0, Math.max(take * 10, 100));
  const starters = newRows.filter(
    (r) =>
      r.word.wordList.name === HSK1_STARTER_LIST_NAME &&
      r.word.wordList.createdById === null &&
      HSK1_STARTER_TERMS.includes(r.word.term)
  );
  return weightedInterleave(withStarterOrder(window, starters), ranks, take).map(
    (r) => r.word.term
  );
}

describe("HSK 1 starter ordering", () => {
  it("every starter term exists exactly once in the seeded HSK 1 data", () => {
    for (const term of HSK1_STARTER_TERMS) {
      expect(hsk1Terms.filter((t) => t === term)).toHaveLength(1);
    }
  });

  it("gives a fresh HSK 1 learner the starter set as their first 10 new cards", () => {
    expect(nextNewTerms(listRows(hsk1Terms), 10)).toEqual([
      "你好", "谢谢", "再见", "我", "你", "是", "好", "不", "他", "这",
    ]);
  });

  it("returns a prefix of the starter set for a smaller daily limit", () => {
    expect(nextNewTerms(listRows(hsk1Terms), 3)).toEqual(["你好", "谢谢", "再见"]);
  });

  it("continues in frequency order once the starter set is introduced", () => {
    const stillNew = listRows(hsk1Terms).filter(
      (r) => !HSK1_STARTER_TERMS.includes(r.word.term)
    );
    const expected = hsk1Terms
      .filter((t) => !HSK1_STARTER_TERMS.includes(t))
      .slice(0, 10);
    expect(expected.slice(0, 4)).toEqual(["的", "了", "在", "有"]);
    expect(nextNewTerms(stillNew, 10)).toEqual(expected);
  });

  it("never brings back introduced words: only still-NEW starters move up", () => {
    // A learner 20 words into frequency order: 我 你 是 好 不 他 这 are already
    // introduced (not NEW, so not in the input); 你好 谢谢 再见 are still NEW.
    const stillNew = listRows(hsk1Terms).filter((r) => r.word.position >= 20);
    const next = nextNewTerms(stillNew, 5);
    expect(next).toEqual(["你好", "谢谢", "再见", hsk1Terms[20], hsk1Terms[21]]);
  });

  it("leaves other lists alone, even with the same terms or name", () => {
    const other = listRows(["的", "你好", "谢谢"], "freq", "Top 100 Most Common Words");
    const own = listRows(["的", "你好", "谢谢"], "mine", HSK1_STARTER_LIST_NAME, "user-1");
    expect(withStarterOrder(other, [])).toEqual(other);
    expect(withStarterOrder(own, [])).toEqual(own);
    expect(nextNewTerms(other, 3)).toEqual(["的", "你好", "谢谢"]);
  });

  it("keeps the multi-list mix: starters only reorder within HSK 1", () => {
    const rows = [
      ...listRows(hsk1Terms),
      ...listRows(["甲", "乙", "丙", "丁"], "other", "Other list"),
    ];
    const ranks = new Map([["hsk1", 0], ["other", 1]]);
    // 2:1 split of 6, round-robin.
    expect(nextNewTerms(rows, 6, ranks)).toEqual(["你好", "甲", "谢谢", "乙", "再见", "我"]);
  });

  it("does not mutate its inputs or duplicate rows present in both", () => {
    const rows = listRows(hsk1Terms);
    const snapshot = JSON.parse(JSON.stringify(rows));
    const starters = rows.filter((r) => HSK1_STARTER_TERMS.includes(r.word.term));
    const merged = withStarterOrder(rows.slice(0, 100), starters);
    expect(rows).toEqual(snapshot);
    expect(new Set(merged.map((r) => r.wordId)).size).toBe(merged.length);
    // 7 starters are inside the window, 3 (谢谢, 再见, 你好) beyond it.
    expect(merged).toHaveLength(103);
  });
});
