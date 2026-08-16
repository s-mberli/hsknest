"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CardStack } from "@/components/study/CardStack";
import { EmptyQueue } from "@/components/study/EmptyQueue";
import { GradeIsland } from "@/components/study/GradeIsland";
import { SessionComplete } from "@/components/study/SessionComplete";
import { SessionHud } from "@/components/study/SessionHud";
import { StudyShell } from "@/components/study/StudyShell";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import { useStudySession, type SwipeDirection } from "@/hooks/useStudySession";
import { trackEventOnce } from "@/lib/analytics";
import { QUALITY_BY_DIRECTION } from "@/lib/grading";
import { playCelebrate, playGrade, setSoundEnabled } from "@/lib/sound";
import type { CardTextSize } from "@/lib/textSize";

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
  const { query, scoped, practice, listIds } = useQueueQuery();
  const {
    loading,
    cards,
    current,
    upcoming,
    stage,
    reviewed,
    gradeableTotal,
    combo,
    bestCombo,
    correct,
    missed,
    lastGrade,
    done,
    startedAt,
    elapsedMs,
    advance,
    swipe,
    continuePreview,
  } = useStudySession(query, { showReading, practice });

  const [, setConsecutiveMouseClicks] = useState(0);

  // Kill switch listening for keyboard grading events.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown"
      ) {
        try {
          localStorage.setItem("hsknest-used-hotkeys", "true");
        } catch {
          // ignore storage access errors
        }
        setConsecutiveMouseClicks(0);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasSeenToastRef = useRef(false);

  const trackMouseClickForNudge = useCallback(() => {
    if (hasSeenToastRef.current) return;
    
    // Only nudge if it's a device with a fine pointer (mouse/desktop).
    // It makes no sense to tell mobile users to "use arrow keys".
    if (window.matchMedia("(pointer: coarse)").matches) return;
    
    let hasUsedHotkeys = false;
    try {
      hasUsedHotkeys = !!localStorage.getItem("hsknest-used-hotkeys");
    } catch {
      // ignore
    }

    if (!hasUsedHotkeys) {
      setConsecutiveMouseClicks((prev) => {
        const next = prev + 1;
        if (next === 6) {
          toast("Tip: Use arrow keys to grade instantly.");
          hasSeenToastRef.current = true;
          return 0;
        }
        return next;
      });
    }
  }, []);

  const handleAdvance = useCallback(
    (isMouseClick = false) => {
      advance();
      if (isMouseClick) {
        trackMouseClickForNudge();
      }
    },
    [advance, trackMouseClickForNudge]
  );

  const handleSwipe = useCallback(
    (direction: SwipeDirection, isMouseClick = false) => {
      swipe(direction);
      if (isMouseClick) {
        trackMouseClickForNudge();
      }
    },
    [swipe, trackMouseClickForNudge]
  );

  const handleContinue = useCallback(
    (isMouseClick = false) => {
      continuePreview();
      if (isMouseClick) {
        trackMouseClickForNudge();
      }
    },
    [continuePreview, trackMouseClickForNudge]
  );

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
    <StudyShell studyTheme={studyTheme}>
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
          <div className="mx-auto w-full max-w-sm animate-pulse">
            <div className="aspect-[3/4] w-full rounded-2xl border border-muted/60 bg-muted/30" />
          </div>
        )}

        {!loading && done && cards.length === 0 && (
          <EmptyQueue scoped={scoped} practice={practice} listIds={listIds} />
        )}

        {!loading && done && cards.length > 0 && (
          <SessionComplete
            reviewed={reviewed}
            correct={correct}
            bestCombo={bestCombo}
            elapsedMs={elapsedMs}
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
              onAdvance={handleAdvance}
              onSwipe={handleSwipe}
              onContinue={handleContinue}
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
    </StudyShell>
  );
}
