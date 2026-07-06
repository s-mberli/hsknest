"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { SwipeCard } from "@/components/study/SwipeCard";
import type { Stage, StudyCard, SwipeDirection } from "@/hooks/useStudySession";

interface CardStackProps {
  current: StudyCard;
  upcoming: StudyCard[];
  stage: Stage;
  onAdvance: () => void;
  onSwipe: (direction: SwipeDirection) => void;
}

/** Edge-glow color per grade direction. */
const GLOW: Record<SwipeDirection, string> = {
  right: "var(--success)",
  left: "var(--destructive)",
  up: "var(--success)",
  down: "var(--amber)",
};

export function CardStack({
  current,
  upcoming,
  stage,
  onAdvance,
  onSwipe,
}: CardStackProps) {
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(
    null
  );
  const [glow, setGlow] = useState<SwipeDirection | null>(null);

  function handleSwipe(direction: SwipeDirection) {
    setExitDirection(direction);
    setGlow(direction);
    onSwipe(direction);
    window.setTimeout(() => setGlow(null), 350);
  }

  // Keyboard: Space advances a stage; arrows grade only at FULL.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        onAdvance();
        return;
      }
      if (stage !== "FULL") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSwipe("right");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSwipe("left");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handleSwipe("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleSwipe("down");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, onAdvance]);

  const behind = [...upcoming].reverse();

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
      {/* Edge glow flash on commit. */}
      <AnimatePresence>
        {glow && (
          <motion.div
            key={glow}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute -inset-3 z-0 rounded-3xl"
            style={{
              boxShadow: `0 0 40px 6px ${GLOW[glow]}`,
            }}
          />
        )}
      </AnimatePresence>

      {behind.map((card, idx) => {
        const depth = behind.length - idx;
        return (
          <SwipeCard
            key={card.wordId}
            card={card}
            stage="TERM"
            onSwipe={handleSwipe}
            depth={depth}
            isTop={false}
            exitDirection={null}
          />
        );
      })}

      <AnimatePresence
        initial={false}
        onExitComplete={() => setExitDirection(null)}
      >
        <SwipeCard
          key={current.wordId}
          card={current}
          stage={stage}
          onSwipe={handleSwipe}
          onAdvance={onAdvance}
          depth={0}
          isTop
          exitDirection={exitDirection}
        />
      </AnimatePresence>
    </div>
  );
}
