"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { EmptyQueue } from "@/components/study/EmptyQueue";
import NinjaStage from "@/components/ninja/NinjaStage";
import { SessionComplete } from "@/components/study/SessionComplete";
import { StudyShell } from "@/components/study/StudyShell";
import { useNinjaEngine } from "@/hooks/useNinjaEngine";
import { usePracticeSession } from "@/hooks/usePracticeSession";
import { useQueueFetcher } from "@/hooks/useQueueFetcher";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import { useSessionTiming } from "@/hooks/useSessionTiming";
import type { NinjaWord } from "@/lib/ninja/distractors";
import { usePrefersReducedMotion } from "@/lib/motion";
import { WAVES_PER_SESSION } from "@/lib/ninja/scoring";
import { setSoundEnabled } from "@/lib/sound";

interface NinjaScreenProps {
  studyTheme: "dark" | "follow";
  soundEffects: boolean;
}

export function NinjaScreen(props: NinjaScreenProps) {
  return (
    <Suspense fallback={null}>
      <NinjaSession {...props} />
    </Suspense>
  );
}

function NinjaSession({ studyTheme, soundEffects }: NinjaScreenProps) {
  const { query, scoped, listIds } = useQueueQuery();
  const reducedMotion = usePrefersReducedMotion();

  // NinjaScreen.tsx's own gotcha, same as StudyScreen: sound defaults to
  // enabled at the module level, and only the screens that read a user
  // setting can turn it off.
  useEffect(() => {
    setSoundEnabled(soundEffects);
  }, [soundEffects]);

  const fetchUrl = useMemo(() => {
    // Ninja is always practice — it drills words already in the queue via
    // slicing, never introduces a brand-new word under time pressure.
    const practiceQuery = query.includes("mode=") ? query : `${query}&mode=practice`;
    return `/api/study/queue?${practiceQuery}`;
  }, [query]);

  const { cards, loading } = useQueueFetcher(fetchUrl);

  // Cards without a Chinese term can't be sliced meaningfully (no glyph to
  // paint on a tile) — filter to words with a usable term, same spirit as
  // MatchScreen filtering to cards it can render.
  const words: NinjaWord[] = useMemo(
    () =>
      cards
        .filter((c) => c.term)
        .map((c) => ({
          wordId: c.wordId,
          term: c.term,
          translation: c.translation,
          phonetic: c.phonetic ?? undefined,
          pos: extractPos(c.metadata),
          frequencyRank: extractFrequencyRank(c.metadata),
        })),
    [cards]
  );

  // Language for pronunciation audio. A scoped session (one language/list)
  // is the common case; an unscoped mixed-language queue just uses the
  // first card's language — acceptable for v1 since playAudio falls back to
  // Web Speech per-text regardless, and getting it wrong only means one
  // outcome's clip is silent or in the wrong accent, not a crash.
  const langCode = cards[0]?.languageCode ?? "zh";

  const { grade, bestCombo, correct, missed } = usePracticeSession({ practice: true });

  const engine = useNinjaEngine({
    words,
    onWaveOutcome: (outcome) => {
      if (!outcome.wordId) return; // no target resolved yet (shouldn't happen)
      const word = words.find((w) => w.wordId === outcome.wordId);
      if (!word) return;
      grade(word.wordId, outcome.quality, word.term, word.translation);
    },
  });

  const gameOver = engine.view.waveStatus === "game-over";
  const { elapsedMs } = useSessionTiming(gameOver);

  const empty = !loading && words.length < 2; // need a target + at least one distractor

  // A twitch game cannot be made accessible by slowing it down — that's a
  // degraded experience dressed up as inclusion, not real support. The
  // honest answer would be a genuinely different, motion-free task (the
  // Sweep-based "Static Sweep" mode from the original plan), but that mode
  // is out of scope. Until an alternative exists, don't offer this one to
  // prefers-reduced-motion users at all — DashboardHero already hides the
  // entry point, this is the defensive backstop for anyone who bookmarked
  // or typed the URL directly.
  if (reducedMotion) {
    return (
      <StudyShell studyTheme={studyTheme}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="text-xl font-bold tracking-tight">Not available with reduced motion</h2>
          <p className="max-w-sm text-muted-foreground">
            Hanzi Ninja is a fast-paced, motion-heavy game with no reduced-motion
            alternative yet. Your device is set to prefer reduced motion, so this
            mode is hidden — try Word Match or the Meaning Quiz instead.
          </p>
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </StudyShell>
    );
  }

  if (loading) {
    return (
      <StudyShell studyTheme={studyTheme}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading your words…</p>
        </div>
      </StudyShell>
    );
  }

  if (empty) {
    return (
      <StudyShell studyTheme={studyTheme}>
        <EmptyQueue scoped={scoped} practice listIds={listIds} />
      </StudyShell>
    );
  }

  if (gameOver) {
    return (
      <StudyShell studyTheme={studyTheme}>
        <SessionComplete
          reviewed={Math.min(engine.view.waveIndex + 1, WAVES_PER_SESSION)}
          correct={correct}
          bestCombo={bestCombo}
          elapsedMs={elapsedMs}
          missed={missed}
          practice
          note="Ninja practice never changes your review schedule."
        />
      </StudyShell>
    );
  }

  // NinjaStage is its own fixed-inset shell (the physics stage needs full
  // control of its bounding box for tile math) — it deliberately doesn't go
  // through StudyShell like the other branches above.
  return (
    <NinjaStage
      view={engine.view}
      stageRef={engine.stageRef}
      tileElRefs={engine.tileElRefs}
      stateRef={engine.stateRef}
      langCode={langCode}
      exitHref="/dashboard"
    />
  );
}

/** metadata.pos is a per-word string array (see recall-architecture-contract). */
function extractPos(metadata: Record<string, unknown> | null): string[] | undefined {
  const pos = metadata?.pos;
  return Array.isArray(pos) ? pos.filter((p): p is string => typeof p === "string") : undefined;
}

/** metadata.frequencyRank — lower is more common. Missing on non-HSK/custom words. */
function extractFrequencyRank(metadata: Record<string, unknown> | null): number | undefined {
  const rank = metadata?.frequencyRank;
  return typeof rank === "number" && Number.isFinite(rank) ? rank : undefined;
}
