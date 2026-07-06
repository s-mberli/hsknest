"use client";

import { Suspense, useRef } from "react";

import { CardStack } from "@/components/study/CardStack";
import { EmptyQueue } from "@/components/study/EmptyQueue";
import { SessionComplete } from "@/components/study/SessionComplete";
import { SessionHud } from "@/components/study/SessionHud";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import { useStudySession } from "@/hooks/useStudySession";
import type { CardTextSize } from "@/lib/textSize";
import { cn } from "@/lib/utils";

interface StudyScreenProps {
  studyTheme: "dark" | "follow";
  textSize: CardTextSize;
}

export function StudyScreen({ studyTheme, textSize }: StudyScreenProps) {
  return (
    <Suspense fallback={null}>
      <StudySession studyTheme={studyTheme} textSize={textSize} />
    </Suspense>
  );
}

function StudySession({ studyTheme, textSize }: StudyScreenProps) {
  const { query, scoped } = useQueueQuery();
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
    done,
    advance,
    swipe,
  } = useStudySession(query);

  const startedAt = useRef(Date.now()).current;

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
      />

      <main className="flex flex-1 flex-col justify-center px-6 pb-16">
        {loading && (
          <p className="text-center text-sm text-muted-foreground">
            Loading your cards…
          </p>
        )}

        {!loading && done && cards.length === 0 && (
          <EmptyQueue scoped={scoped} />
        )}

        {!loading && done && cards.length > 0 && (
          <SessionComplete
            reviewed={reviewed}
            correct={correct}
            bestCombo={bestCombo}
            elapsedMs={Date.now() - startedAt}
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
