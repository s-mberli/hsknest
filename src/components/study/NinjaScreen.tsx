"use client";

import { Suspense, useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { EmptyQueue } from "@/components/study/EmptyQueue";
import NinjaStage from "@/components/ninja/NinjaStage";
import { StudyShell } from "@/components/study/StudyShell";
import { useNinjaEngine } from "@/hooks/useNinjaEngine";
import { usePracticeSession } from "@/hooks/usePracticeSession";
import { useQueueFetcher } from "@/hooks/useQueueFetcher";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import type { NinjaWord } from "@/lib/ninja/distractors";
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

  const { cards, loading, error } = useQueueFetcher(fetchUrl);

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

  // usePracticeSession's grade() writes ReviewLog rows for the SRS side
  // effect only — it does NOT drive any UI here. NinjaStage owns its own
  // game-over screen (waves survived, best combo, "New Best!") and renders
  // it internally once view.waveStatus flips to "game-over"; this screen
  // must not intercept that state and swap in a different UI, or
  // NinjaStage's game-over branch never gets a chance to render.
  const { grade } = usePracticeSession({ practice: true, source: "ninja" });

  const engine = useNinjaEngine({
    words,
    onWaveOutcome: (outcome) => {
      if (!outcome.wordId) return; // no target resolved yet (shouldn't happen)
      const word = words.find((w) => w.wordId === outcome.wordId);
      if (!word) return;
      // Map speed-tiered quality (1|3|4|5) to pass/fail (1|4) for the SRS write.
      // Speed under motor pressure is not evidence of recall strength.
      const srsQuality = outcome.quality === 1 ? 1 : 4;
      grade(word.wordId, srsQuality, word.term, word.translation);
    },
  });

  const empty = !loading && !error && words.length < 2; // need a target + at least one distractor

  if (loading) {
    return (
      <StudyShell studyTheme={studyTheme}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading your words…</p>
        </div>
      </StudyShell>
    );
  }

  // Distinct from "empty deck": useQueueFetcher already toasted the failure.
  // Rendering EmptyQueue here would tell the user their deck is empty when
  // the request actually failed — misleading, and the wrong recovery action.
  if (error) {
    return (
      <StudyShell studyTheme={studyTheme}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load your words. Check your connection and try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
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
      studyTheme={studyTheme}
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
