"use client";

import { Suspense, useEffect, useRef, useState } from "react";

import { CardStack } from "@/components/study/CardStack";
import { EmptyQueue } from "@/components/study/EmptyQueue";
import { GradeIsland } from "@/components/study/GradeIsland";
import { SessionComplete } from "@/components/study/SessionComplete";
import { SessionHud } from "@/components/study/SessionHud";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import { useStudySession } from "@/hooks/useStudySession";
import type { CardTextSize } from "@/lib/textSize";
import { cn } from "@/lib/utils";

interface StudyScreenProps {
  studyTheme: "dark" | "follow";
  textSize: CardTextSize;
  showReading?: boolean;
}

export function StudyScreen({
  studyTheme,
  textSize,
  showReading = true,
}: StudyScreenProps) {
  return (
    <Suspense fallback={null}>
      <StudySession
        studyTheme={studyTheme}
        textSize={textSize}
        showReading={showReading}
      />
    </Suspense>
  );
}

function StudySession({ studyTheme, textSize, showReading = true }: StudyScreenProps) {
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
  } = useStudySession(query, { showReading, practice });

  const startedAt = useRef(Date.now()).current;

  const [milestoneFire, setMilestoneFire] = useState(0);
  const prevBestCombo = useRef(0);
  const MILESTONES = [5, 10, 20];

  useEffect(() => {
    const prev = prevBestCombo.current;
    if (MILESTONES.some((m) => prev < m && bestCombo >= m)) {
      setMilestoneFire((f) => f + 1);
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
        total={cards.length}
        combo={combo}
        startedAt={startedAt}
        milestoneFire={milestoneFire}
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
              textSize={textSize}
            />

            <p className="text-center text-xs text-muted-foreground">
              Tap to reveal · at the answer, swipe or use ← → ↑ ↓ to grade
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
