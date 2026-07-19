"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { trackEventOnce } from "@/lib/analytics";

export interface StudyCard {
  wordId: string;
  term: string;
  translation: string;
  phonetic: string | null;
  metadata: Record<string, unknown> | null;
  state: string;
  kind?: string;
  languageCode?: string;
  lapses?: number;
  /** First-ever exposure of a brand-new word: ungraded blue preview. */
  preview?: boolean;
  /** One example sentence for the word, when the library has one. */
  sentence?: {
    text: string;
    translation: string;
    phonetic: string | null;
    source: string | null;
  };
}

/** Reveal stages of a card. Phonetic-less words skip PHONETIC. */
export type Stage = "TERM" | "PHONETIC" | "FULL";

/** Grade gestures map to SM-2 qualities. */
export type SwipeDirection = "left" | "right" | "up" | "down";

const QUALITY_BY_DIRECTION: Record<SwipeDirection, number> = {
  left: 1, // forgot
  right: 4, // knew
  up: 5, // easy
  down: 3, // hard / barely
};

/** Latest grade outcome, for transient UI feedback (Dynamic Island pill). */
export interface LastGrade {
  /** Increments per grade so consumers can retrigger animations via key. */
  id: number;
  direction: SwipeDirection;
  correct: boolean;
  combo: number;
}

interface UseStudySession {
  loading: boolean;
  cards: StudyCard[];
  current: StudyCard | null;
  upcoming: StudyCard[];
  stage: Stage;
  remaining: number;
  reviewed: number;
  combo: number;
  bestCombo: number;
  correct: number;
  /** Cards graded wrong this session (deduped), for the session summary. */
  missed: { term: string; translation: string }[];
  /** Outcome of the most recent grade, or null before the first one. */
  lastGrade: LastGrade | null;
  done: boolean;
  /** Advance the reveal stage (tap / Space). */
  advance: () => void;
  /** Grade the current card (only meaningful at FULL). */
  swipe: (direction: SwipeDirection) => void;
  /** Dismiss a new-word preview: re-queues the card for real grading. */
  continuePreview: () => void;
}

/**
 * Next reveal stage for a card; phonetic-less words jump straight to FULL.
 * When the reading hint is hidden, TERM also jumps straight to FULL so the
 * learner recalls the pronunciation themselves (it still shows with the answer).
 */
/** Cards between a new-word preview and its graded reappearance. */
const PREVIEW_GAP = 3;

/**
 * Keep the server's order (all due reviews first, new words last) and just
 * flag each brand-new word's first appearance as an ungraded preview. The
 * preview then re-queues itself a few cards later for real grading (see
 * continuePreview) — still within the new-word tail, never before the reviews.
 */
function markPreviews(fetched: StudyCard[]): StudyCard[] {
  return fetched.map((c) => (c.kind === "new" ? { ...c, preview: true } : c));
}

function nextStage(
  stage: Stage,
  card: StudyCard | null,
  showReading: boolean
): Stage {
  if (stage === "TERM") return showReading && card?.phonetic ? "PHONETIC" : "FULL";
  return "FULL";
}

interface StudySessionOptions {
  /** false → skip the intermediate reading-hint stage. Defaults to true. */
  showReading?: boolean;
  /** true → practice/refresh mode: reviews don't advance the SRS schedule. */
  practice?: boolean;
}

/** `query` is the queue query string, e.g. "limit=10" or "minutes=5". */
export function useStudySession(
  query = "limit=20",
  { showReading = true, practice = false }: StudySessionOptions = {}
): UseStudySession {
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [cursor, setCursor] = useState(0);
  const [stage, setStage] = useState<Stage>("TERM");
  const [loading, setLoading] = useState(true);
  const [reviewed, setReviewed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState<{ term: string; translation: string }[]>(
    []
  );
  const [lastGrade, setLastGrade] = useState<LastGrade | null>(null);
  const gradeCounter = useRef(0);
  const requeued = useRef<Set<string>>(new Set());
  // Cards graded below "Good" once already — their repeat reviews are logged
  // as practice so the schedule isn't advanced/reset twice in one session.
  const relearning = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/study/queue?${query}`);
        if (!res.ok) throw new Error("queue fetch failed");
        const data = await res.json();
        if (active) setCards(markPreviews(data.cards ?? []));
      } catch {
        if (active) toast.error("Could not load your study session.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [query]);

  const current = cursor < cards.length ? cards[cursor] : null;
  const upcoming = cards.slice(cursor + 1, cursor + 3);
  const done = !loading && current === null;

  const advance = useCallback(() => {
    setStage((s) => nextStage(s, current, showReading));
  }, [current, showReading]);

  // Preview cards are never graded: dismissing one re-queues the same card a
  // few positions later, where it appears as a normal card with real grades.
  const continuePreview = useCallback(() => {
    const card = cards[cursor];
    if (!card?.preview) return;
    setCards((prev) => {
      const next = [...prev];
      const insertAt = Math.min(cursor + 1 + PREVIEW_GAP, next.length);
      next.splice(insertAt, 0, { ...card, preview: false });
      return next;
    });
    setCursor((c) => c + 1);
    setStage("TERM");
  }, [cards, cursor]);

  const swipe = useCallback(
    (direction: SwipeDirection) => {
      const card = cards[cursor];
      if (!card) return;
      if (card.preview) {
        continuePreview();
        return;
      }

      const quality = QUALITY_BY_DIRECTION[direction];
      const wasCorrect = quality >= 3;

      // Combo: consecutive q>=3 this session; resets quietly otherwise.
      if (wasCorrect) {
        setCombo((c) => {
          const next = c + 1;
          setBestCombo((b) => Math.max(b, next));
          gradeCounter.current += 1;
          setLastGrade({
            id: gradeCounter.current,
            direction,
            correct: true,
            combo: next,
          });
          return next;
        });
        setCorrect((n) => n + 1);
      } else {
        setCombo(0);
        gradeCounter.current += 1;
        setLastGrade({
          id: gradeCounter.current,
          direction,
          correct: false,
          combo: 0,
        });
        setMissed((m) =>
          m.some((w) => w.term === card.term)
            ? m
            : [...m, { term: card.term, translation: card.translation }]
        );
      }

      // SM-2 step 7: repeat every card graded below 4 (Again/Hard) later in
      // the same session until it scores ≥4. Only the FIRST grade moves the
      // schedule; repeats are logged as practice (no interval/EF change).
      const isRepeat = relearning.current.has(card.wordId);
      if (quality < 4) {
        relearning.current.add(card.wordId);
        setCards((prev) => [...prev, card]);
      }

      // Optimistic: advance immediately, post in the background.
      setCursor((c) => c + 1);
      setStage("TERM");
      setReviewed((r) => r + 1);

      void (async () => {
        const body = JSON.stringify({
          wordId: card.wordId,
          quality,
          ...(practice || isRepeat ? { practice: true } : {}),
        });

        const post = () =>
          fetch("/api/study/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });

        // Re-queue the card once at the end so progress isn't silently lost.
        const requeue = () => {
          if (!requeued.current.has(card.wordId)) {
            requeued.current.add(card.wordId);
            setCards((prev) => [...prev, card]);
            setReviewed((r) => Math.max(0, r - 1));
          }
        };

        try {
          const res = await post();
          if (res.ok) {
            // Launch-funnel activation signal: first saved review ever on
            // this browser (no-op when analytics isn't configured).
            trackEventOnce("first_review_complete");
            return;
          }

          // Stale card (progress wiped elsewhere): drop silently.
          if (res.status === 404) return;

          // Transient server errors: retry once, then requeue + toast.
          if (res.status >= 500) {
            await new Promise((r) => setTimeout(r, 1500));
            const retry = await post();
            if (retry.ok) return;
            requeue();
            toast.error("Couldn't save that review — we'll ask again.");
            return;
          }

          // Other 4xx (validation etc.): won't succeed on replay. Toast, no requeue.
          toast.error("Couldn't save that review.");
        } catch {
          // Network error: retry once, then requeue + toast.
          await new Promise((r) => setTimeout(r, 1500));
          try {
            const retry = await post();
            if (retry.ok) return;
            if (retry.status === 404) return;
          } catch {
            // fall through to requeue
          }
          requeue();
          toast.error("Couldn't save that review — we'll ask again.");
        }
      })();
    },
    [cards, cursor, practice, continuePreview]
  );

  return {
    loading,
    cards,
    current,
    upcoming,
    stage,
    remaining: Math.max(0, cards.length - cursor),
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
  };
}
