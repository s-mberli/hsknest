/**
 * CC-CEDICT access for Reading Mode hydration.
 *
 * Reads the repo's vendored trim (`prisma/data/cedict/cedict.json.gz`):
 *   key (simplified or traditional headword) → [[numberedPinyin, meanings[]], ...]
 *   (up to 3 homograph entries, up to 3 meanings each — see that folder's README).
 *
 * Node-only; loaded at ingest time so the client never ships a dictionary.
 */

import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { convert } from "pinyin-pro";

export type CedictEntry = [string, string[]];
export type CedictData = Record<string, CedictEntry[]>;

let cache: CedictData | null = null;

export function loadCedict(dataPath?: string): CedictData {
  if (cache && !dataPath) return cache;
  const defaultDataPath = path.join(
    process.cwd(),
    "prisma",
    "data",
    "cedict",
    "cedict.json.gz"
  );
  const raw = gunzipSync(
    dataPath
      ? fs.readFileSync(/* turbopackIgnore: true */ dataPath)
      : fs.readFileSync(defaultDataPath)
  );
  const data = JSON.parse(raw.toString("utf-8")) as CedictData;
  if (!dataPath) cache = data;
  return data;
}

/** "ni3 hao3" → "nǐ hǎo" (best effort; numbered pinyin stays on failure). */
export function toneMark(pinyinNumbered: string): string {
  try {
    return convert(pinyinNumbered, { format: "numToSymbol" }) as string;
  } catch {
    return pinyinNumbered;
  }
}
