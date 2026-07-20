"use client";

import { motion } from "framer-motion";
import { Suspense, useEffect, useMemo, useState } from "react";

import { EmptyQueue } from "@/components/study/EmptyQueue";
import { SessionComplete } from "@/components/study/SessionComplete";
import { SessionHud } from "@/components/study/SessionHud";
import { usePracticeSession } from "@/hooks/usePracticeSession";
import { useQueueFetcher } from "@/hooks/useQueueFetcher";
import { useQueueQuery } from "@/hooks/useQueueQuery";
import type { StudyCard } from "@/hooks/useStudySession";
import { playAudio } from "@/lib/audio";
import { gameGloss } from "@/lib/meanings";
import { cn } from "@/lib/utils";

interface MatchScreenProps {
  studyTheme: "dark" | "follow";
}

const ROUND_SIZE = 5;

interface Tile {
  wordId: string;
  text: string;
  side: "term" | "translation";
}

interface TileButtonProps {
  tile: Tile;
  matched: Set<string>;
  selected: Tile | null;
  shaking: string | null;
  wrongPair: { a: Tile; b: Tile } | null;
  onTap: (tile: Tile) => void;
}

function TileButton({ tile, matched, selected, shaking, wrongPair, onTap }: TileButtonProps) {
  const isMatched = matched.has(tile.wordId);
  const isSelected =
    selected?.wordId === tile.wordId && selected.side === tile.side;
  const isShaking = shaking === `${tile.side}:${tile.wordId}`;
  const isWrong = wrongPair && (
    (wrongPair.a.wordId === tile.wordId && wrongPair.a.side === tile.side) ||
    (wrongPair.b.wordId === tile.wordId && wrongPair.b.side === tile.side)
  );

  return (
    <motion.button
      type="button"
      onClick={() => onTap(tile)}
      disabled={isMatched}
      animate={
        isShaking
          ? { x: [0, -8, 8, -6, 6, 0] }
          : isMatched
          ? { scale: [1, 1.1, 0.95], opacity: 0.5 }
          : isSelected
          ? { scale: 1.05 }
          : { scale: 1, x: 0 }
      }
      transition={{ duration: 0.35 }}
      className={cn(
        "w-full rounded-xl border bg-card px-3 py-3 text-sm font-medium transition-all duration-200",
        tile.side === "term" && "break-words text-base",
        isMatched && "border-success bg-success/10 text-success/70 pointer-events-none",
        !isMatched && isWrong && "border-destructive bg-destructive/10 text-destructive",
        !isMatched && !isWrong && isSelected && "border-primary bg-primary/15 shadow-sm",
        !isMatched && !isWrong && !isSelected && "hover:border-primary/50 hover:bg-accent"
      )}
    >
      {tile.text}
    </motion.button>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function MatchScreen({ studyTheme }: MatchScreenProps) {
  return (
    <Suspense fallback={null}>
      <MatchSession studyTheme={studyTheme} />
    </Suspense>
  );
}

function MatchSession({ studyTheme }: MatchScreenProps) {
  const { query, scoped } = useQueueQuery();
  const practice = true;
  const [round, setRound] = useState(0);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [graded, setGraded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Tile | null>(null);
  const [shaking, setShaking] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<{ a: Tile; b: Tile } | null>(null);
  const [startedAt] = useState(() => Date.now());

  const { grade, combo, bestCombo, correct, missed: missedWords } = usePracticeSession({ practice: true });

  const fetchUrl = useMemo(() => {
    const practiceQuery = query.includes("mode=")
      ? query
      : `${query}&mode=practice`;
    return `/api/study/queue?${practiceQuery}`;
  }, [query]);

  const { cards, loading } = useQueueFetcher(fetchUrl);

  const rounds = useMemo(() => {
    const out: StudyCard[][] = [];
    for (let i = 0; i < cards.length; i += ROUND_SIZE) {
      const chunk = cards.slice(i, i + ROUND_SIZE);
      if (chunk.length >= 2) out.push(chunk);
    }
    return out;
  }, [cards]);

  const roundCards = rounds[round] ?? null;

  const tiles = useMemo(() => {
    if (!roundCards) return { terms: [] as Tile[], translations: [] as Tile[] };
    return {
      terms: shuffle(
        roundCards.map((c) => ({
          wordId: c.wordId,
          text: c.term,
          side: "term" as const,
        }))
      ),
      translations: shuffle(
        roundCards.map((c) => ({
          wordId: c.wordId,
          text: gameGloss(c),
          side: "translation" as const,
        }))
      ),
    };
  }, [roundCards]);

  const done = !loading && (rounds.length === 0 || round >= rounds.length);

  const [endTime, setEndTime] = useState(0);
  useEffect(() => {
    if (done) queueMicrotask(() => setEndTime(Date.now()));
  }, [done]);

  function tap(tile: Tile) {
    if (matched.has(tile.wordId)) return;
    if (!selected) {
      setSelected(tile);
      return;
    }
    if (selected.wordId === tile.wordId && selected.side === tile.side) {
      setSelected(null);
      return;
    }
    if (selected.side === tile.side) {
      setSelected(tile);
      return;
    }

    if (selected.wordId === tile.wordId) {
      const wasMissed = missed.has(tile.wordId);
      // Hear the word on a successful match (tap = unlock gesture on mobile).
      const matchedCard = cards.find((c) => c.wordId === tile.wordId);
      if (matchedCard) {
        void playAudio(matchedCard.term, "word", matchedCard.languageCode);
      }
      setMatched((prev) => {
        const next = new Set(prev).add(tile.wordId);
        if (roundCards && roundCards.every((c) => next.has(c.wordId))) {
          window.setTimeout(() => {
            setMatched(new Set());
            setMissed(new Set());
            setRound((r) => r + 1);
          }, 600);
        }
        return next;
      });
      if (!graded.has(tile.wordId)) {
        const card = cards.find((c) => c.wordId === tile.wordId);
        if (card) {
          grade(card.wordId, wasMissed ? 1 : 4, card.term, card.translation);
        }
        setGraded((prev) => new Set(prev).add(tile.wordId));
      }
      setSelected(null);
    } else {
      setMissed((prev) => new Set(prev).add(selected.wordId));
      setWrongPair({ a: selected, b: tile });
      setShaking(`${tile.side}:${tile.wordId}`);
      window.setTimeout(() => {
        setShaking(null);
        setWrongPair(null);
      }, 400);
      setSelected(null);
    }
  }

  const totalWords = rounds.reduce((n, r) => n + r.length, 0);
  const gradedCount = graded.size;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background text-foreground",
        studyTheme === "dark" && "dark"
      )}
    >
      <SessionHud
        reviewed={gradedCount}
        total={totalWords}
        combo={combo}
        startedAt={startedAt}
        practice
      />

      <main className="flex flex-1 flex-col justify-center px-6 pb-16">
        {loading && (
          <p className="text-center text-sm text-muted-foreground">
            Loading your matching round…
          </p>
        )}

        {done && rounds.length === 0 && (
          <EmptyQueue scoped={scoped} practice={practice} />
        )}

        {done && rounds.length > 0 && (
          <SessionComplete
            reviewed={totalWords}
            correct={correct}
            bestCombo={bestCombo}
            elapsedMs={endTime ? endTime - startedAt : 0}
            missed={missedWords}
            practice
          />
        )}

        {!loading && roundCards && (
          <motion.div
            key={round}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto flex w-full max-w-md flex-col gap-6"
          >
            <div className="text-center">
              <h2 className="text-lg font-bold tracking-tight mb-1">Tap matching pairs</h2>
              <p className="text-xs text-muted-foreground">
                Round {round + 1} of {rounds.length}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                {tiles.terms.map((t) => (
                  <TileButton
                    key={`term:${t.wordId}`}
                    tile={t}
                    matched={matched}
                    selected={selected}
                    shaking={shaking}
                    wrongPair={wrongPair}
                    onTap={tap}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {tiles.translations.map((t) => (
                  <TileButton
                    key={`translation:${t.wordId}`}
                    tile={t}
                    matched={matched}
                    selected={selected}
                    shaking={shaking}
                    wrongPair={wrongPair}
                    onTap={tap}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
