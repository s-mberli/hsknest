"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronsUp, Minus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { SwipeCard } from "@/components/study/SwipeCard";
import type { Stage, StudyCard, SwipeDirection } from "@/hooks/useStudySession";
import type { CardTextSize } from "@/lib/textSize";
import { cn } from "@/lib/utils";

interface CardStackProps {
  current: StudyCard;
  upcoming: StudyCard[];
  stage: Stage;
  onAdvance: () => void;
  onSwipe: (direction: SwipeDirection) => void;
  /** Dismiss a new-word preview (no grade posted). */
  onContinue: () => void;
  textSize: CardTextSize;
  /** Speak the term automatically when its reading is revealed. */
  autoPlay?: boolean;
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
  onContinue,
  textSize,
  autoPlay = false,
}: CardStackProps) {
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(
    null
  );
  const [glow, setGlow] = useState<string | null>(null);
  const preview = !!current.preview;

  function handleSwipe(direction: SwipeDirection) {
    // Preview cards aren't graded: any commit gesture just continues.
    const dir = preview ? "right" : direction;
    setExitDirection(dir);
    setGlow(preview ? "#0ea5e9" : GLOW[direction]);
    if (preview) onContinue();
    else onSwipe(direction);
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

  // On-screen grade buttons (mirror the swipe/keyboard gestures) shown once
  // the answer is revealed. Order left→right: Again, Hard, Good, Easy.
  const GRADES: {
    dir: SwipeDirection;
    label: string;
    icon: typeof Check;
    className: string;
  }[] = [
    { dir: "left", label: "Again", icon: X, className: "text-destructive border-destructive/40 hover:bg-destructive/10" },
    { dir: "down", label: "Hard", icon: Minus, className: "text-amber border-amber/40 hover:bg-amber/10" },
    { dir: "right", label: "Good", icon: Check, className: "text-success border-success/40 hover:bg-success/10" },
    { dir: "up", label: "Easy", icon: ChevronsUp, className: "text-sky-600 dark:text-sky-400 border-sky-500/40 hover:bg-sky-500/10" },
  ];

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
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
              boxShadow: `0 0 40px 6px ${glow}`,
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
            textSize={textSize}
          />
        );
      })}

      <AnimatePresence
        initial={false}
        onExitComplete={() => setExitDirection(null)}
      >
        <SwipeCard
          // Distinct key for the preview vs. its graded reappearance so
          // AnimatePresence still animates when they end up adjacent.
          key={`${current.wordId}${current.preview ? ":preview" : ""}`}
          card={current}
          stage={stage}
          onSwipe={handleSwipe}
          onAdvance={onAdvance}
          depth={0}
          isTop
          exitDirection={exitDirection}
          textSize={textSize}
          autoPlay={autoPlay}
        />
      </AnimatePresence>
    </div>

      {/* Grade buttons: enabled only once the answer is revealed. Previews of
          brand-new words get a single Continue instead — no grading yet. */}
      {preview ? (
        <div
          className={cn(
            "transition-opacity",
            stage === "FULL" ? "opacity-100" : "pointer-events-none opacity-30"
          )}
          aria-hidden={stage !== "FULL"}
        >
          <button
            type="button"
            onClick={() => handleSwipe("right")}
            disabled={stage !== "FULL"}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/40 py-3 text-sm font-medium text-sky-600 transition-colors hover:bg-sky-500/10 dark:text-sky-400"
          >
            <Check className="size-5" />
            Got it — continue
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-4 gap-2 transition-opacity",
            stage === "FULL" ? "opacity-100" : "pointer-events-none opacity-30"
          )}
          aria-hidden={stage !== "FULL"}
        >
          {GRADES.map(({ dir, label, icon: Icon, className }) => (
            <button
              key={dir}
              type="button"
              onClick={() => handleSwipe(dir)}
              disabled={stage !== "FULL"}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-colors",
                className
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
