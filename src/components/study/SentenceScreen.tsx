"use client";

import { motion } from "framer-motion";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyQueue } from "@/components/study/EmptyQueue";
import { HighlightedSentence } from "@/components/study/HighlightedSentence";
import { SessionComplete } from "@/components/study/SessionComplete";
import { SessionHud } from "@/components/study/SessionHud";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import type { StudyCard } from "@/hooks/useStudySession";
import { gameGloss } from "@/lib/meanings";
import { postReview } from "@/lib/postReview";
import { CARD_TEXT_CLASSES, type CardTextSize } from "@/lib/textSize";
import { cn } from "@/lib/utils";

type SentenceCard = StudyCard & {
  sentence?: { text: string; translation: string; source: string | null };
};

interface SentenceScreenProps {
  studyTheme: "dark" | "follow";
  textSize: CardTextSize;
}

/** Self-grade buttons, mirroring the flashcard swipe qualities. */
const GRADES: { label: string; quality: number; className: string }[] = [
  { label: "Again", quality: 1, className: "text-destructive border-destructive/40 hover:bg-destructive/10" },
  { label: "Hard", quality: 3, className: "text-amber border-amber/40 hover:bg-amber/10" },
  { label: "Good", quality: 4, className: "text-success border-success/40 hover:bg-success/10" },
  { label: "Easy", quality: 5, className: "text-sky-600 dark:text-sky-400 border-sky-500/40 hover:bg-sky-500/10" },
];

export function SentenceScreen({ studyTheme, textSize }: SentenceScreenProps) {
  return (
    <Suspense fallback={null}>
      <SentenceSession studyTheme={studyTheme} textSize={textSize} />
    </Suspense>
  );
}

function SentenceSession({ studyTheme, textSize }: SentenceScreenProps) {
  const { query, scoped, practice } = useQueueQuery();
  const [cards, setCards] = useState<SentenceCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [missed, setMissed] = useState<{ term: string; translation: string }[]>(
    []
  );
  const [skipped, setSkipped] = useState(0);
  const startedAt = useRef(Date.now()).current;
  // Words graded below Good once — repeats are logged as practice (same
  // in-session relearn contract as flashcards; SM-2 step 7).
  const relearning = useRef<Set<string>>(new Set());
  const sizes = CARD_TEXT_CLASSES[textSize];

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/study/queue?${query}&sentences=1`);
        if (!res.ok) throw new Error("queue fetch failed");
        const data = await res.json();
        if (active) {
          // Sentence practice needs an example sentence; skip cards without one.
          const all: SentenceCard[] = data.cards ?? [];
          const usable = all.filter((c) => c.sentence);
          setCards(usable);
          setSkipped(all.length - usable.length);
        }
      } catch {
        if (active) toast.error("Could not load your sentences.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [query]);

  const current = cursor < cards.length ? cards[cursor] : null;
  const done = !loading && current === null;

  function grade(quality: number) {
    if (!current || !revealed) return;
    if (quality >= 4) {
      setCorrect((n) => n + 1);
      setCombo((c) => {
        const next = c + 1;
        setBestCombo((b) => Math.max(b, next));
        return next;
      });
    } else {
      setCombo(0);
      if (quality <= 1) {
        setMissed((m) =>
          m.some((w) => w.term === current.term)
            ? m
            : [...m, { term: current.term, translation: current.translation }]
        );
      }
    }
    // Failed/hard words repeat later in the session until graded ≥ Good; only
    // the first grade moves the schedule, repeats post as practice.
    const isRepeat = relearning.current.has(current.wordId);
    if (quality < 4) {
      relearning.current.add(current.wordId);
      setCards((prev) => [...prev, current]);
    }
    void postReview(current.wordId, quality, practice || isRepeat);
    setRevealed(false);
    setCursor((c) => c + 1);
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background text-foreground",
        studyTheme === "dark" && "dark"
      )}
    >
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
            elapsedMs={Date.now() - startedAt}
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
                  <p className={cn("text-muted-foreground", sizes.phoneticHint)}>
                    {current.sentence.translation}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {current.term}
                    </span>
                    {current.phonetic && <> · {current.phonetic}</>} ·{" "}
                    {gameGloss(current)}
                  </p>
                </motion.div>
              )}
            </div>

            {revealed ? (
              <div className="grid w-full grid-cols-4 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => grade(g.quality)}
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
                onClick={() => setRevealed(true)}
                className="w-full rounded-xl border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent"
              >
                Show translation
              </button>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Read the sentence, then grade how well you knew the highlighted
              word
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
