// PROTOTYPE — throwaway code, not wired to SRS/Prisma/network. Safe to delete.

import type { NinjaTile } from "./ninjaTypes";
import { launchTile } from "./ninjaPhysics";
import type { StageBounds } from "./ninjaTypes";

export interface TestWord {
  char: string;
  translation: string;
}

export const TEST_WORDS: TestWord[] = [
  { char: "吃", translation: "eat" },
  { char: "喝", translation: "drink" },
  { char: "睡", translation: "sleep" },
  { char: "看", translation: "look / watch" },
  { char: "说", translation: "speak" },
  { char: "听", translation: "listen" },
  { char: "读", translation: "read" },
  { char: "写", translation: "write" },
  { char: "走", translation: "walk / go" },
  { char: "跑", translation: "run" },
];

export const DISTRACTOR_POOL: string[] = [
  "学",
  "生",
  "老",
  "师",
  "中",
  "国",
  "人",
  "大",
  "小",
  "多",
  "少",
  "好",
  "坏",
  "高",
  "低",
  "长",
  "短",
  "快",
  "慢",
  "早",
];

const WAVE_SIZE = 4;

/** Builds a wave of 4 tiles: one random-lane target + 3 unique distractors. */
export function buildWave(
  targetWord: TestWord,
  rng: () => number,
  bounds: StageBounds,
  spawnTime: number
): NinjaTile[] {
  const targetLane = Math.floor(rng() * WAVE_SIZE);

  // Pick 3 unique distractors (never equal to the target char).
  const pool = DISTRACTOR_POOL.filter((c) => c !== targetWord.char);
  const chosen: string[] = [];
  const poolCopy = [...pool];
  while (chosen.length < WAVE_SIZE - 1 && poolCopy.length > 0) {
    const idx = Math.floor(rng() * poolCopy.length);
    chosen.push(poolCopy[idx]);
    poolCopy.splice(idx, 1);
  }

  const tiles: NinjaTile[] = [];
  let distractorCursor = 0;
  for (let lane = 0; lane < WAVE_SIZE; lane += 1) {
    const isTarget = lane === targetLane;
    const char = isTarget ? targetWord.char : chosen[distractorCursor++];
    tiles.push(
      launchTile(rng, bounds, 0, lane, WAVE_SIZE, char, isTarget, spawnTime)
    );
  }
  return tiles;
}
