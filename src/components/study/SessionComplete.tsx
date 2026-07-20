"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuroraGlow } from "@/components/fx/AuroraGlow";
import { ConfettiCannon } from "@/components/fx/ConfettiCannon";
import { Button } from "@/components/ui/button";

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
      <h2 className="text-2xl font-bold tracking-tight">
        {practice ? "Practice done" : "Session complete"}
      </h2>
      <p className="text-muted-foreground">
        You reviewed {reviewed} {reviewed === 1 ? "card" : "cards"}.{" "}
        {practice
          ? "Just practice — nothing here changed your upcoming reviews."
          : "Nice work."}
      </p>
      {note && (
        <p className="max-w-xs text-xs text-muted-foreground">{note}</p>
      )}
      {tomorrowDue !== null && (
        <p className="max-w-xs text-sm text-muted-foreground">
          {tomorrowDue > 0
            ? `Come back tomorrow — ${tomorrowDue} ${tomorrowDue === 1 ? "review" : "reviews"} will be waiting.`
            : "Nothing due tomorrow — the schedule brings words back right before you'd forget them."}
        </p>
      )}

      <div className="mt-2 grid w-full max-w-xs grid-cols-3 gap-3">
        <Stat label="Accuracy" value={`${accuracy}%`} valueClassName={accuracyTint} />
        <Stat label="Best combo" value={String(bestCombo)} />
        <Stat label="Time" value={formatElapsed(elapsedMs)} />
      </div>

      {missed.length > 0 && (
        <div className="mt-2 w-full max-w-xs rounded-lg border bg-card p-3 text-left">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Toughest this round
          </p>
          <ul className="space-y-1.5">
            {missed.slice(0, 5).map((w) => (
              <li key={w.term} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{w.term}</span>
                <span className="truncate text-muted-foreground">{w.translation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex w-full max-w-xs flex-col gap-2 sm:max-w-md sm:flex-row sm:flex-wrap sm:justify-center">
        {missed.length > 0 && (
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              const searchParams = new URLSearchParams(window.location.search);
              searchParams.set("mode", "practice");
              searchParams.set("limit", String(missed.length));
              window.location.href = `${window.location.pathname}?${searchParams.toString()}`;
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
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
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
