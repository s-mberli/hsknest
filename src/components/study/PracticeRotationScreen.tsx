"use client";

import { useCallback, useEffect, useState } from "react";

import { MatchScreen } from "@/components/study/MatchScreen";
import { QuizScreen } from "@/components/study/QuizScreen";
import { SentenceScreen } from "@/components/study/SentenceScreen";
import { PracticeRotationContext } from "@/lib/practiceRotationContext";
import { advanceRound, startRotation, type PracticeRotationState } from "@/lib/practiceRotation";
import { PRACTICE_MODE_LABELS, type PracticeModeKey } from "@/lib/practiceModes";
import { type CardTextSize } from "@/lib/textSize";

interface PracticeRotationScreenProps {
  available: readonly PracticeModeKey[];
  studyTheme: "dark" | "follow";
  textSize: CardTextSize;
}

/**
 * Wrapper that resolves Practice modes via Rotation and renders that
 * mode's existing screen, unchanged. The mode label is overlaid so the choice
 * reads as intentional rather than glitchy.
 *
 * Manages round-to-round hand-off: when a round ends, the next round begins
 * in place in a different mode (or the same mode if only one is available).
 * Nothing here touches grading, queueing, or scheduling — it's pure
 * selection and screen remounting. Previous mode lives in client state only,
 * so a page reload starts fresh.
 *
 * Mode resolution happens in useEffect on mount (not during render) so the
 * server-rendered HTML and first client render agree — random selection at
 * render time is a hydration mismatch. Renders null until resolved.
 */
export function PracticeRotationScreen({
  available,
  studyTheme,
  textSize,
}: PracticeRotationScreenProps) {
  const [state, setState] = useState<PracticeRotationState | null>(null);

  // Resolve the mode once on mount via Rotation. Never changes during the
  // round. Reacting to Math.random() becoming safe to call post-hydration
  // (the server can't produce it at all) rather than deriving state from
  // props/state — the case this lint rule is meant to exempt (same pattern as
  // ReaderView's post-hydration prefs load).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(startRotation(available));
  }, [available]);

  // Advance to the next round: promote the already-decided `next` mode to
  // `current`, increment the round counter, record current as previous for
  // variety enforcement. Keying the rendered screen by `${round}-${current}`
  // forces a full remount, so each round starts with a fresh queue fetch.
  // Declared before the early return below so hook order never changes
  // across renders (Rules of Hooks) — regardless of whether `state` is
  // resolved yet.
  const handleNextRound = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      return advanceRound(prev, available);
    });
  }, [available]);

  // Hydration: while resolving, render nothing. The mode screens already
  // fetch their queue asynchronously, so this costs one frame.
  if (!state || !state.current) return null;

  const current = state.current;

  // The label for the *next* mode (shown in the "Next round" button) is read
  // from the already-decided `state.next`, never re-drawn here — a fresh
  // Math.random() call at render time could announce a mode the click then
  // doesn't deliver.
  const nextModeLabel = state.next ? PRACTICE_MODE_LABELS[state.next] : null;

  const contextValue = {
    nextRound: handleNextRound,
    nextModeLabel,
  };

  return (
    <PracticeRotationContext.Provider value={contextValue}>
      <div className="relative w-full h-screen">
        {/* Render the chosen mode's existing screen — completely unchanged.
            It uses Suspense internally, so queue fetches are non-blocking.
            Keying forces a remount on each round, giving a genuinely fresh
            queue and state without any screen needing an imperative reset. */}
        <div key={`${state.round}-${current}`}>
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
        </div>

        {/* Mode label pill: overlaid top-center so the choice is visible and
            intentional. Updates every round to prove mode rotation is working.
            Does not edit any mode screen or SessionHud. */}
        <div className="absolute top-0 left-0 right-0 flex justify-center pt-4 pointer-events-none z-50">
          <div className="rounded-full border border-dashed bg-card/80 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Practice · {PRACTICE_MODE_LABELS[current]}
          </div>
        </div>
      </div>
    </PracticeRotationContext.Provider>
  );
}
