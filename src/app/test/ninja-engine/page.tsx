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
  { wordId: "1", term: "吃", translation: "eat", pos: ["verb"] },
  { wordId: "2", term: "喝", translation: "drink", pos: ["verb"] },
  { wordId: "3", term: "睡", translation: "sleep", pos: ["verb"] },
  { wordId: "4", term: "走", translation: "walk", pos: ["verb"] },
  { wordId: "5", term: "学", translation: "study", pos: ["verb"] },
  { wordId: "6", term: "中国", translation: "China", pos: ["proper noun"] },
  { wordId: "7", term: "学生", translation: "student", pos: ["noun"] },
  { wordId: "8", term: "老师", translation: "teacher", pos: ["noun"] },
  { wordId: "9", term: "朋友", translation: "friend", pos: ["noun"] },
  { wordId: "10", term: "书", translation: "book", pos: ["noun"] },
];

export default function NinjaEngineTestPage() {
  const { stageRef, tileElRefs, view } = useNinjaEngine({
    words: TEST_WORDS,
  });

  return <NinjaStage view={view} stageRef={stageRef} tileElRefs={tileElRefs} />;
}
