"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AuroraGlow } from "@/components/fx/AuroraGlow";
import { ConfettiCannon } from "@/components/fx/ConfettiCannon";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { UpgradeModal } from "@/components/auth/UpgradeModal";
import { usePrefersReducedMotion } from "@/lib/motion";

// Natural-deceleration curve used throughout the app's authored entrances
// (see DESIGN.md's motion guidance) — confident arrival, no bounce.
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * One top-to-bottom reveal, not independent per-element entrances: headline,
 * then the stat row as a group, then the missed-words card, then actions —
 * each step a beat behind the last so the eye is told where to look next
 * instead of everything landing in the same frame as the icon.
 */
const revealParent = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};
const revealItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};
// Reduced motion keeps the same beats (so screen-reader/focus order and
// staggered relevance are unaffected) but drops the spatial travel and delay
// — a same-frame fade instead of a choreographed rise.
const revealItemReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

interface SessionCompleteProps {
  reviewed: number;
  correct: number;
  bestCombo: number;
  elapsedMs: number;
  /** Words graded wrong this session — shown as "toughest this round". */
  missed?: { term: string; translation: string }[];
  /** True when this was a practice/refresh session (schedule untouched). */
  practice?: boolean;
  /** Extra mode-specific footnote, e.g. "3 words without sentences skipped". */
  note?: string;
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function SessionComplete({
  reviewed,
  correct,
  bestCombo,
  elapsedMs,
  missed = [],
  practice = false,
  note,
}: SessionCompleteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const isGuest = session?.user?.email?.endsWith("@guest.local") ?? false;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const item = reducedMotion ? revealItemReduced : revealItem;
  const accuracy = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0;
  const accuracyTint =
    accuracy >= 80
      ? "text-success"
      : accuracy >= 50
        ? "text-amber"
        : "text-destructive";

  const [fire] = useState(accuracy >= 80 ? 1 : 0);

  // "What now?" orientation for new users: surface tomorrow's review count so
  // finishing a session ends with a concrete next step, not a dead end.
  const [tomorrowDue, setTomorrowDue] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((stats) => {
        if (!cancelled && stats && Array.isArray(stats.forecast)) {
          setTomorrowDue(stats.forecast[1] ?? 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-6 text-center">
      <AuroraGlow />
      <ConfettiCannon fire={fire} intensity={150} />
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <CheckCircle2 className="size-14 text-primary" />
      </motion.div>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={revealParent}
        className="contents"
      >
        <motion.h2 variants={item} className="text-2xl font-bold tracking-tight">
          {practice ? "Practice done" : "Session complete"}
        </motion.h2>
        <motion.p variants={item} className="text-muted-foreground">
          You reviewed {reviewed} {reviewed === 1 ? "card" : "cards"}.{" "}
          {practice
            ? "Just practice — nothing here changed your upcoming reviews."
            : "Nice work."}
        </motion.p>
        {note && (
          <motion.p variants={item} className="max-w-xs text-xs text-muted-foreground">
            {note}
          </motion.p>
        )}
        {tomorrowDue !== null && (
          <motion.p variants={item} className="max-w-xs text-sm text-muted-foreground">
            {tomorrowDue > 0
              ? `Come back tomorrow — ${tomorrowDue} ${tomorrowDue === 1 ? "review" : "reviews"} will be waiting.`
              : "Nothing due tomorrow — the schedule brings words back right before you'd forget them."}
          </motion.p>
        )}

        <motion.div variants={item} className="mt-2 grid w-full max-w-xs grid-cols-3 gap-3">
          <Stat
            label="Accuracy"
            value={<CountUp to={accuracy} suffix="%" reduced={reducedMotion} />}
            valueClassName={accuracyTint}
          />
          <Stat label="Best combo" value={<CountUp to={bestCombo} reduced={reducedMotion} />} />
          <Stat label="Time" value={formatElapsed(elapsedMs)} />
        </motion.div>

        {missed.length > 0 && (
          <motion.div variants={item} className="mt-2 w-full max-w-xs rounded-lg border bg-card p-3 text-left">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Toughest this round
            </p>
            <ul className="space-y-1.5">
              {missed.slice(0, 5).map((w) => (
                <li key={w.term} className="flex items-baseline justify-between gap-3 text-sm">
                  <span data-term className="font-medium">{w.term}</span>
                  <span className="truncate text-muted-foreground">{w.translation}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {!isGuest && (
          <motion.div
            variants={item}
            className="mt-4 flex w-full max-w-xs flex-col gap-2 sm:max-w-md sm:flex-row sm:flex-wrap sm:justify-center"
          >
            {missed.length > 0 && (
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("mode", "practice");
                  params.set("limit", String(missed.length));
                  router.push(`${pathname}?${params.toString()}`);
                }}
              >
                Redo the {missed.length} you missed
              </Button>
            )}
            <Button
              asChild
              variant={missed.length > 0 ? "outline" : "default"}
              className="w-full sm:w-auto"
            >
              {/* Stay in the same mode (sentences, quiz, …), not the flashcard screen. */}
              <Link href={`${pathname}?mode=practice&limit=20`}>Keep practicing</Link>
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                // Force fresh dashboard counts after studying (avoid stale ring).
                router.push("/dashboard");
                router.refresh();
              }}
            >
              Back to dashboard
            </Button>
          </motion.div>
        )}

        {isGuest && (
          <motion.div variants={item} className="mt-4 w-full max-w-xs sm:max-w-md">
            <Button size="lg" className="w-full text-md font-semibold" onClick={() => setShowUpgrade(true)}>
              Save Progress & Continue Free
            </Button>
          </motion.div>
        )}
      </motion.div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        title="Save your progress"
        description="Create a free account to sync your FSRS memory model across your phone and desktop."
        canClose={true}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className={`text-xl font-bold tabular-nums ${valueClassName ?? ""}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Counts up from 0 to `to` once, on mount — the one number a learner opened
 * this screen to see gets a tally instead of just appearing, same way a
 * scoreboard settles rather than snapping to the final total. Runs once
 * (StrictMode-safe via a ref guard) and renders the final value immediately
 * under reduced motion instead of animating the digits.
 */
function CountUp({
  to,
  suffix = "",
  reduced,
}: {
  to: number;
  suffix?: string;
  reduced: boolean;
}) {
  const [value, setValue] = useState(reduced ? to : 0);
  const started = useRef(false);

  useEffect(() => {
    if (reduced || started.current) return;
    started.current = true;
    const durationMs = 650;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // matches EASE_OUT's cubic-ish settle
      setValue(Math.round(eased * to));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, reduced]);

  return (
    <span aria-label={`${to}${suffix}`}>
      {value}
      {suffix}
    </span>
  );
}
