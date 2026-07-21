"use client";

import { motion } from "framer-motion";
import { Check, ChevronsUp, Minus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SwipeCard } from "@/components/study/SwipeCard";
import type { Stage, StudyCard, SwipeDirection } from "@/hooks/useStudySession";
import type { CardTextSize } from "@/lib/textSize";
import { cn } from "@/lib/utils";

interface CardStackProps {
  current: StudyCard;
  upcoming: StudyCard[];
  stage: Stage;
  onAdvance: () => void;
  onSwipe: (direction: SwipeDirection, isMouseClick?: boolean) => void;
  /** Dismiss a new-word preview (no grade posted). */
  onContinue: () => void;
  textSize: CardTextSize;
  /** Speak the term automatically when its reading is revealed. */
  autoPlay?: boolean;
}

/** Edge-glow color per grade direction. */
const GLOW: Record<SwipeDirection, string> = {
  right: "#22c55e",
  left: "#ef4444",
  up: "#0ea5e9",
  down: "#f59e0b",
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
  // Committed cards fly off under our own timer instead of AnimatePresence:
  // its exit tracking silently breaks under the current React/framer pairing
  // and dismissed cards pile up frozen on screen.
  const [flying, setFlying] = useState<
    { key: string; card: StudyCard; dir: SwipeDirection }[]
  >([]);
  const flyCounter = useRef(0);
  const [glow, setGlow] = useState<string | null>(null);
  const preview = !!current.preview;

  const handleSwipe = useCallback(
    (direction: SwipeDirection, isMouseClick = false) => {
      // Preview cards aren't graded: any commit gesture just continues.
      const dir = preview ? "right" : direction;
      const key = `fly-${flyCounter.current++}`;
      setFlying((f) => [...f, { key, card: current, dir }]);
      window.setTimeout(
        () => setFlying((f) => f.filter((x) => x.key !== key)),
        450
      );
      setGlow(preview ? "#0ea5e9" : GLOW[direction]);
      if (preview) onContinue();
      else onSwipe(direction, isMouseClick);
      window.setTimeout(() => setGlow(null), 350);
    },
    [preview, current, onContinue, onSwipe]
  );

  // Keyboard: Space advances a stage; arrows grade only at FULL.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (stage === "FULL" && preview) {
          handleSwipe("right");
        } else {
          onAdvance();
        }
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
  }, [stage, onAdvance, preview, handleSwipe]);

  const behind = [...upcoming].reverse();

  // On-screen grade buttons (mirror the swipe/keyboard gestures) shown once
  // the answer is revealed. Order left→right: Forgot, Hard, Knew, Easy.
  const GRADES: {
    dir: SwipeDirection;
    label: string;
    icon: typeof Check;
    className: string;
  }[] = [
    { dir: "left", label: "Forgot", icon: X, className: "text-destructive border-destructive/40 hover:bg-destructive/10" },
    { dir: "down", label: "Hard", icon: Minus, className: "text-amber border-amber/40 hover:bg-amber/10" },
    { dir: "right", label: "Knew", icon: Check, className: "text-success border-success/40 hover:bg-success/10" },
    { dir: "up", label: "Easy", icon: ChevronsUp, className: "text-sky-600 dark:text-sky-400 border-sky-500/40 hover:bg-sky-500/10" },
  ];

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
    <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
      {/* Edge glow flash on commit — fades itself out before removal. */}
      {glow && (
        <motion.div
          key={glow}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.4, times: [0, 0.3, 1] }}
          className="pointer-events-none absolute -inset-4 z-0 rounded-3xl"
          style={{
            boxShadow: `0 0 50px 12px ${glow}, 0 0 20px 4px ${glow}`,
          }}
        />
      )}

      {behind.map((card, idx) => {
        const depth = behind.length - idx;
        return (
          <SwipeCard
            // Same compound key as the top card: a new word appears twice in
            // the deck (preview + graded reappearance), so wordId alone dupes.
            key={`${card.wordId}${card.preview ? ":preview" : ""}`}
            card={card}
            stage="TERM"
            onSwipe={handleSwipe}
            depth={depth}
            isTop={false}
            textSize={textSize}
          />
        );
      })}

      <SwipeCard
        // Distinct key for the preview vs. its graded reappearance so the
        // top card remounts (and re-animates) when they end up adjacent.
        key={`${current.wordId}${current.preview ? ":preview" : ""}`}
        card={current}
        stage={stage}
        onSwipe={handleSwipe}
        onAdvance={onAdvance}
        depth={0}
        isTop
        textSize={textSize}
        autoPlay={autoPlay}
      />

      {/* Committed cards mid-flight (self-removed after the animation). */}
      {flying.map((f) => (
        <SwipeCard
          key={f.key}
          card={f.card}
          stage="FULL"
          onSwipe={handleSwipe}
          depth={0}
          isTop={false}
          flyOut={f.dir}
          textSize={textSize}
        />
      ))}
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
            onClick={() => handleSwipe("right", true)}
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
              onClick={() => handleSwipe(dir, true)}
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
