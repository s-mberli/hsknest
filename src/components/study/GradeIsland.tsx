"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import type { LastGrade } from "@/hooks/useStudySession";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface GradeIslandProps {
  lastGrade: LastGrade | null;
}

function outcomeFor(grade: LastGrade): { text: string; className: string } {
  switch (grade.direction) {
    case "right":
      return {
        text:
          grade.combo >= 2 ? `Nice · ${grade.combo} in a row` : "Nice",
        className: "text-success",
      };
    case "up":
      return { text: "Easy", className: "text-success" };
    case "down":
      return { text: "Hard, but got it", className: "text-amber" };
    case "left":
    default:
      return { text: "Again", className: "text-destructive" };
  }
}

/**
 * Centered pill near the top HUD that morphs to show the outcome of each
 * grade, then auto-collapses back to a small idle/neutral dot. Wensity-style
 * "Dynamic Island" moment — layers on top of the existing edge-glow flash.
 */
export function GradeIsland({ lastGrade }: GradeIslandProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!lastGrade) return;
    setExpanded(true);
    const timeout = window.setTimeout(() => setExpanded(false), 900);
    return () => window.clearTimeout(timeout);
  }, [lastGrade]);

  const showExpanded = expanded && lastGrade;
  const outcome = lastGrade ? outcomeFor(lastGrade) : null;

  return (
    <div className="pointer-events-none flex justify-center py-1.5">
      <motion.div
        layout={!reducedMotion}
        transition={
          reducedMotion
            ? { duration: 0.15 }
            : { type: "spring", stiffness: 400, damping: 28 }
        }
        className={cn(
          "flex items-center justify-center rounded-full border bg-card px-3 py-1 text-sm font-semibold shadow-sm",
          showExpanded ? "min-w-24" : "size-2 min-w-0 border-transparent bg-muted p-0"
        )}
      >
        <AnimatePresence mode="wait">
          {showExpanded && outcome && (
            <motion.span
              key={lastGrade.id}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: reducedMotion ? 0.15 : 0.2 }}
              className={cn("whitespace-nowrap", outcome.className)}
            >
              {outcome.text}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
