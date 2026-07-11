"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flame, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ConfettiCannon } from "@/components/fx/ConfettiCannon";
import { Button } from "@/components/ui/button";

interface SessionHudProps {
  reviewed: number;
  total: number;
  combo: number;
  /** Session start timestamp (ms) for the timer. */
  startedAt: number;
  /** Bump to trigger a small confetti burst near the HUD (combo milestones). */
  milestoneFire?: number;
  /** True for practice/game sessions — shows a "doesn't count" pill. */
  practice?: boolean;
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

/** Top HUD: progress bar, combo counter, session timer, exit. */
export function SessionHud({
  reviewed,
  total,
  combo,
  startedAt,
  milestoneFire = 0,
  practice = false,
}: SessionHudProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const pct = total > 0 ? Math.min(100, (reviewed / total) * 100) : 0;

  return (
    <div className="relative">
      <ConfettiCannon fire={milestoneFire} intensity={40} />
      {/* Thin vermilion progress bar. */}
      <div className="h-0.5 w-full bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>

      <header className="flex items-center justify-between px-5 py-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard" aria-label="Exit session">
            <X className="size-5" />
          </Link>
        </Button>

        <div className="flex items-center gap-4">
          {practice && (
            <span
              className="rounded-full border border-dashed px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              title="Practice doesn't change when your words come up for review."
            >
              Practice — doesn&apos;t count toward reviews
            </span>
          )}
          <AnimatePresence>
            {combo >= 2 && (
              <motion.span
                key={combo}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex items-center gap-1 text-sm font-semibold text-primary"
              >
                <Flame className="size-4" />
                {combo}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatElapsed(now - startedAt)}
          </span>
        </div>
      </header>
    </div>
  );
}
