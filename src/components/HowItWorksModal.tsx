"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface HowItWorksModalProps {
  open: boolean;
  onClose: () => void;
}

/** Grade → what happens to when you next see the card. */
const GRADES: { label: string; effect: string; dot: string }[] = [
  { label: "Again", effect: "Reset — comes back very soon", dot: "bg-destructive" },
  { label: "Hard", effect: "Comes back sooner than last time", dot: "bg-amber" },
  { label: "Good", effect: "Normal growth — a bit longer each time", dot: "bg-success" },
  { label: "Easy", effect: "Big jump — you won't see it for a while", dot: "bg-sky-500" },
];

/**
 * Zero-dependency explainer modal (no shadcn Dialog in the project). Fixed
 * overlay + centered card, Escape / backdrop click closes. Reused by
 * onboarding, the first-visit dashboard nudge, and Settings.
 */
export function HowItWorksModal({ open, onClose }: HowItWorksModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Lock background scroll while open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // No exit animation on purpose: unmount is synchronous with `open`, so the
  // overlay can never linger (invisibly trapping clicks) if an exit animation
  // stalls (e.g. a backgrounded tab throttling requestAnimationFrame).
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How Recall works"
    >
      <motion.div
        className="relative w-full max-w-md rounded-t-3xl border bg-card p-6 text-left shadow-xl sm:rounded-3xl"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <h2 className="pr-8 text-xl font-bold tracking-tight">
              How Recall works
            </h2>

            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                Recall uses <span className="font-medium text-foreground">spaced
                repetition</span>: instead of cramming, it brings each word back
                right before you&apos;d forget it. Every review pushes the next
                one further out, so words you know well barely take any time.
              </p>
              <p>
                Each day a few <span className="font-medium text-foreground">new
                words</span> trickle in, mixed with{" "}
                <span className="font-medium text-foreground">reviews</span>
                {" "}that have come due. Finish the day&apos;s queue and you&apos;re done —
                or keep going with the practice games.
              </p>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                When you grade a card
              </p>
              <ul className="space-y-2">
                {GRADES.map((g) => (
                  <li key={g.label} className="flex items-baseline gap-3 text-sm">
                    <span
                      className={`size-2.5 shrink-0 translate-y-px self-center rounded-full ${g.dot}`}
                    />
                    <span className="w-14 shrink-0 font-semibold">{g.label}</span>
                    <span className="flex-1 text-muted-foreground">{g.effect}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              Grade honestly and the schedule tunes itself to your memory. You can
              change the algorithm and daily limits any time in Settings.
            </p>

        <Button className="mt-6 w-full rounded-full" onClick={onClose}>
          Got it
        </Button>
      </motion.div>
    </div>
  );
}
