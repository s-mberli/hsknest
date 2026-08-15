/**
 * Offline test page for Phase 4 engine + stage.
 * Hardcoded word array, no SRS/queue/network.
 * DELETE this once Phase 5 wires it to the live app.
 */

"use client";

import { useNinjaEngine } from "@/hooks/useNinjaEngine";
import NinjaStage from "@/components/ninja/NinjaStage";
import type { NinjaWord } from "@/lib/ninja/distractors";

const TEST_WORDS: NinjaWord[] = [
  { wordId: "1", term: "吃", translation: "eat", phonetic: "chī", pos: ["verb"] },
  { wordId: "2", term: "喝", translation: "drink", phonetic: "hē", pos: ["verb"] },
  { wordId: "3", term: "睡", translation: "sleep", phonetic: "shuì", pos: ["verb"] },
  { wordId: "4", term: "走", translation: "walk", phonetic: "zǒu", pos: ["verb"] },
  { wordId: "5", term: "学", translation: "study", phonetic: "xué", pos: ["verb"] },
  { wordId: "6", term: "中", translation: "middle", phonetic: "zhōng", pos: ["noun", "adjective"] },
  { wordId: "7", term: "国", translation: "country", phonetic: "guó", pos: ["noun"] },
  { wordId: "8", term: "人", translation: "person", phonetic: "rén", pos: ["noun"] },
  { wordId: "9", term: "生", translation: "student", phonetic: "shēng", pos: ["noun"] },
  { wordId: "10", term: "书", translation: "book", phonetic: "shū", pos: ["noun"] },
];

export default function NinjaEngineTestPage() {
  const { stageRef, tileElRefs, view, stateRef } = useNinjaEngine({
    words: TEST_WORDS,
  });

  return <NinjaStage view={view} stageRef={stageRef} tileElRefs={tileElRefs} stateRef={stateRef} />;
}
