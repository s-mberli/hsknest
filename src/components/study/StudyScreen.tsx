"use client";

import { Suspense, useEffect, useRef, useState } from "react";

import { CardStack } from "@/components/study/CardStack";
import { EmptyQueue } from "@/components/study/EmptyQueue";
import { GradeIsland } from "@/components/study/GradeIsland";
import { SessionComplete } from "@/components/study/SessionComplete";
import { SessionHud } from "@/components/study/SessionHud";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import { useStudySession } from "@/hooks/useStudySession";
import { trackEventOnce } from "@/lib/analytics";
import { playCelebrate, playGrade, setSoundEnabled } from "@/lib/sound";
import type { CardTextSize } from "@/lib/textSize";
import { cn } from "@/lib/utils";

const QUALITY_BY_DIRECTION = { left: 1, right: 4, up: 5, down: 3 } as const;

interface StudyScreenProps {
  studyTheme: "dark" | "follow";
  textSize: CardTextSize;
  showReading?: boolean;
  soundEffects?: boolean;
  autoPlayPronunciation?: boolean;
  /** Guest account — fires the launch-funnel event on first study screen. */
  isGuest?: boolean;
}

export function StudyScreen({
  studyTheme,
  textSize,
  showReading = true,
  soundEffects = true,
  autoPlayPronunciation = true,
  isGuest = false,
}: StudyScreenProps) {
  return (
    <Suspense fallback={null}>
      <StudySession
        studyTheme={studyTheme}
        textSize={textSize}
        showReading={showReading}
        soundEffects={soundEffects}
        autoPlayPronunciation={autoPlayPronunciation}
        isGuest={isGuest}
      />
    </Suspense>
  );
}

function StudySession({
  studyTheme,
  textSize,
  showReading = true,
  soundEffects = true,
  autoPlayPronunciation = true,
  isGuest = false,
}: StudyScreenProps) {
  const { query, scoped, practice } = useQueueQuery();
  const {
    loading,
    cards,
    current,
    upcoming,
    stage,
    reviewed,
    combo,
    bestCombo,
    correct,
    missed,
    lastGrade,
    done,
    advance,
    swipe,
    continuePreview,
  } = useStudySession(query, { showReading, practice });

  // Preview entries duplicate their graded reappearance — count each word once.
  const gradeableTotal = cards.filter((c) => !c.preview).length;

  const startedAt = useRef(Date.now()).current;

  // Mirror the user's setting into the sound module (no-ops when off).
  useEffect(() => {
    setSoundEnabled(soundEffects);
  }, [soundEffects]);

  // Launch-funnel: guest reached the study screen (per metrics.md this fires
  // here, not on the landing page). Once per browser; no-op without Umami.
  useEffect(() => {
    if (isGuest) trackEventOnce("guest_session_start");
  }, [isGuest]);

  // Play a blip per grade, keyed off lastGrade.id so each grade fires once.
  useEffect(() => {
    if (!lastGrade) return;
    playGrade(QUALITY_BY_DIRECTION[lastGrade.direction]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastGrade?.id]);

  const [milestoneFire, setMilestoneFire] = useState(0);
  const prevBestCombo = useRef(0);
  const MILESTONES = [5, 10, 20];

  useEffect(() => {
    const prev = prevBestCombo.current;
    if (MILESTONES.some((m) => prev < m && bestCombo >= m)) {
      setMilestoneFire((f) => f + 1);
      playCelebrate();
    }
    prevBestCombo.current = bestCombo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestCombo]);

  return (
    // Full-screen distraction-free study. "dark" forces focus mode; "follow"
    // inherits next-themes' class on <html>.
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background text-foreground",
        studyTheme === "dark" && "dark"
      )}
    >
      <SessionHud
        reviewed={reviewed}
        total={gradeableTotal}
        combo={combo}
        startedAt={startedAt}
        milestoneFire={milestoneFire}
        practice={practice}
      />
      <GradeIsland lastGrade={lastGrade} />

      <main className="flex flex-1 flex-col justify-center px-6 pb-16">
        {loading && (
          <p className="text-center text-sm text-muted-foreground">
            Loading your cards…
          </p>
        )}

        {!loading && done && cards.length === 0 && (
          <EmptyQueue scoped={scoped} practice={practice} />
        )}

        {!loading && done && cards.length > 0 && (
          <SessionComplete
            reviewed={reviewed}
            correct={correct}
            bestCombo={bestCombo}
            elapsedMs={Date.now() - startedAt}
            missed={missed}
            practice={practice}
          />
        )}

        {!loading && current && (
          <div className="flex flex-col items-center gap-8">
            <CardStack
              current={current}
              upcoming={upcoming}
              stage={stage}
              onAdvance={advance}
              onSwipe={swipe}
              onContinue={continuePreview}
              textSize={textSize}
              autoPlay={autoPlayPronunciation}
            />

            <p className="text-center text-xs text-muted-foreground">
              {current.preview
                ? "First look at a new word — no grading yet"
                : "Tap to reveal · at the answer, swipe or use ← → ↑ ↓ to grade"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
