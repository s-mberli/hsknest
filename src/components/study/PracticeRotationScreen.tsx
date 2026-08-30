"use client";

import { useEffect, useState } from "react";

import { MatchScreen } from "@/components/study/MatchScreen";
import { QuizScreen } from "@/components/study/QuizScreen";
import { SentenceScreen } from "@/components/study/SentenceScreen";
import { selectPracticeMode } from "@/lib/practiceRotation";
import { PRACTICE_MODE_LABELS, type PracticeModeKey } from "@/lib/practiceModes";
import { type CardTextSize } from "@/lib/textSize";

interface PracticeRotationScreenProps {
  available: readonly PracticeModeKey[];
  studyTheme: "dark" | "follow";
  textSize: CardTextSize;
}

/**
 * Wrapper that resolves one Practice mode via Rotation and renders that
 * mode's existing screen, unchanged. The mode label is overlaid so the choice
 * reads as intentional rather than glitchy.
 *
 * Mode resolution happens in useEffect on mount (not during render) so the
 * server-rendered HTML and first client render agree — random selection at
 * render time is a hydration mismatch. Renders null until resolved.
 *
 * The previous mode lives in component state only. No persistence, no schema
 * change. Ticket 03 will re-resolve on round end using this state.
 */
export function PracticeRotationScreen({
  available,
  studyTheme,
  textSize,
}: PracticeRotationScreenProps) {
  const [current, setCurrent] = useState<PracticeModeKey | null>(null);
  const [previous, setPrevious] = useState<PracticeModeKey | null>(null);

  // Resolve the mode once on mount. After this, it never changes during the
  // round. Round-to-round hand-off (re-resolving and tracking previous) is
  // ticket 03.
  useEffect(() => {
    const next = selectPracticeMode(available, previous);
    setCurrent(next);
  }, [available, previous]);

  // Hydration: while resolving, render nothing. The mode screens already
  // fetch their queue asynchronously, so this costs one frame.
  if (!current) return null;

  return (
    <div className="relative w-full h-screen">
      {/* Render the chosen mode's existing screen — completely unchanged.
          It uses Suspense internally, so queue fetches are non-blocking. */}
      {current === "quiz" && (
        <QuizScreen studyTheme={studyTheme} textSize={textSize} mode="meaning" />
      )}
      {current === "pronounce" && (
        <QuizScreen studyTheme={studyTheme} textSize={textSize} mode="reading" />
      )}
      {current === "match" && (
        <MatchScreen studyTheme={studyTheme} />
      )}
      {current === "sentences" && (
        <SentenceScreen studyTheme={studyTheme} textSize={textSize} />
      )}

      {/* Mode label pill: overlaid top-center so the choice is visible and
          intentional. Does not edit any mode screen or SessionHud. */}
      <div className="absolute top-0 left-0 right-0 flex justify-center pt-4 pointer-events-none z-50">
        <div className="rounded-full border border-dashed bg-card/80 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Practice · {PRACTICE_MODE_LABELS[current]}
        </div>
      </div>
    </div>
  );
}
