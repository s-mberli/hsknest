"use client";

import { motion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { EmptyQueue } from "@/components/study/EmptyQueue";
import { HighlightedSentence } from "@/components/study/HighlightedSentence";
import { SessionComplete } from "@/components/study/SessionComplete";
import { SessionHud } from "@/components/study/SessionHud";
import { StudyShell } from "@/components/study/StudyShell";
import { usePracticeSession } from "@/hooks/usePracticeSession";
import { useQueueFetcher } from "@/hooks/useQueueFetcher";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import { useSessionTiming } from "@/hooks/useSessionTiming";
import type { StudyCard } from "@/hooks/useStudySession";
import { playAudio } from "@/lib/audio";
import {
  GRADE_LABELS,
  QUALITY_BY_DIRECTION,
  requeuesInSession,
  type SwipeDirection,
} from "@/lib/grading";
import { gameGloss } from "@/lib/meanings";
import { CARD_TEXT_CLASSES, type CardTextSize } from "@/lib/textSize";
import { cn } from "@/lib/utils";

type SentenceCard = StudyCard & {
  sentence?: { text: string; translation: string; source: string | null };
};

interface SentenceScreenProps {
  studyTheme: "dark" | "follow";
  textSize: CardTextSize;
}

const GRADES = GRADE_LABELS;

/** Arrow keys → swipe directions, so the deck's grade mapping applies here too. */
const KEY_TO_DIRECTION: Record<string, SwipeDirection | undefined> = {
  ArrowLeft: "left",
  ArrowDown: "down",
  ArrowRight: "right",
  ArrowUp: "up",
};

export function SentenceScreen({ studyTheme, textSize }: SentenceScreenProps) {
  return (
    <Suspense fallback={null}>
      <SentenceSession studyTheme={studyTheme} textSize={textSize} />
    </Suspense>
  );
}

function SentenceSession({ studyTheme, textSize }: SentenceScreenProps) {
  const { query, scoped, practice } = useQueueQuery();
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const sizes = CARD_TEXT_CLASSES[textSize];

  const { grade, combo, bestCombo, correct, missed } = usePracticeSession({ practice });

  const fetchUrl = useMemo(() => `/api/study/queue?${query}&sentences=1`, [query]);

  const { cards: rawCards, loading } = useQueueFetcher(fetchUrl);

  const [cards, setCards] = useState<SentenceCard[]>([]);

  useEffect(() => {
    const all = rawCards as SentenceCard[];
    const usable = all.filter((c) => c.sentence);
    queueMicrotask(() => {
      setCards(usable);
      setSkipped(all.length - usable.length);
    });
  }, [rawCards]);

  const current = cursor < cards.length ? cards[cursor] : null;
  const done = !loading && current === null;
  const { startedAt, elapsedMs } = useSessionTiming(done);

  const reveal = useCallback(() => {
    setRevealed(true);
    // Hear the sentence read aloud on reveal (user-test ask).
    if (current?.sentence) {
      void playAudio(current.sentence.text, "sentence", current.languageCode);
    }
  }, [current]);

  const handleGrade = useCallback(
    (quality: number) => {
      if (!current || !revealed) return;
      if (requeuesInSession(quality)) {
        setCards((prev) => [...prev, current]);
      }
      grade(current.wordId, quality, current.term, current.translation);
      setRevealed(false);
      setCursor((c) => c + 1);
    },
    [current, revealed, grade]
  );

  // Same gestures as the flashcard deck: Space reveals, then the arrows grade
  // on the identical direction→quality mapping (see @/lib/grading). Without
  // this, sentence mode was the only graded screen with no keyboard path.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Never steal keystrokes from a text field (mirrors CardStack).
      const target = e.target as HTMLElement;
      if (
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === " " || e.code === "Space") {
        e.preventDefault(); // else Space scrolls the page
        if (!revealed) reveal();
        return;
      }

      if (!revealed) return;
      const dir = KEY_TO_DIRECTION[e.key];
      if (!dir) return;
      e.preventDefault();
      handleGrade(QUALITY_BY_DIRECTION[dir]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, reveal, handleGrade]);

  return (
    <StudyShell studyTheme={studyTheme}>
      <SessionHud
        reviewed={cursor}
        total={cards.length}
        combo={combo}
        startedAt={startedAt}
        practice={practice}
      />

      <main className="flex flex-1 flex-col justify-center px-6 pb-16">
        {loading && (
          <p className="text-center text-sm text-muted-foreground">
            Loading your sentences…
          </p>
        )}

        {done && cards.length === 0 && (
          <div className="flex flex-col items-center gap-3">
            <EmptyQueue scoped={scoped} practice={practice} />
            {skipped > 0 && (
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                {skipped} {skipped === 1 ? "word doesn't" : "words don't"} have
                example sentences yet — sentence practice covers words that
                appear in the bundled sentence library. Try flashcards for the
                rest.
              </p>
            )}
          </div>
        )}

        {done && cards.length > 0 && (
          <SessionComplete
            reviewed={cards.length}
            correct={correct}
            bestCombo={bestCombo}
            elapsedMs={elapsedMs}
            missed={missed}
            practice={practice}
            note={
              skipped > 0
                ? `${skipped} ${skipped === 1 ? "word" : "words"} in your queue ${skipped === 1 ? "has" : "have"} no example sentence yet — review those as flashcards.`
                : undefined
            }
          />
        )}

        {!loading && current && current.sentence && (
          <motion.div
            key={current.wordId + String(cursor)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto flex w-full max-w-sm flex-col items-center gap-8"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <HighlightedSentence
                text={current.sentence.text}
                term={current.term}
                className={sizes.translation}
              />
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-2"
                >
                  {current.sentence.phonetic && (
                    <p className={cn("text-muted-foreground", sizes.phoneticHint)}>
                      {current.sentence.phonetic}
                    </p>
                  )}
                  <p className={cn("text-muted-foreground", sizes.phoneticHint)}>
                    {current.sentence.translation}
                  </p>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {current.term}
                      </span>
                      {current.phonetic && <> · {current.phonetic}</>} ·{" "}
                      {gameGloss(current)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (current.sentence) {
                          void playAudio(current.sentence.text, "sentence", current.languageCode);
                        }
                      }}
                      className="rounded-full bg-muted/50 p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Play sentence again"
                      aria-label="Play sentence again"
                    >
                      <Volume2 className="size-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {revealed ? (
              <div className="grid w-full grid-cols-4 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => handleGrade(g.quality)}
                    className={cn(
                      "rounded-xl border bg-card px-2 py-3 text-sm font-semibold transition-colors",
                      g.className
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={reveal}
                className="w-full rounded-xl border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent"
              >
                Show translation
              </button>
            )}

            <p className="text-center text-xs text-muted-foreground">
              {revealed
                ? "Grade how well you knew the highlighted word — or use ← ↓ → ↑"
                : "Read the sentence, then reveal it — tap above or press Space"}
            </p>
          </motion.div>
        )}
      </main>
    </StudyShell>
  );
}
