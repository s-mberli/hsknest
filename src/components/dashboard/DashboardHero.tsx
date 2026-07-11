"use client";

import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FocusRing } from "@/components/dashboard/FocusRing";
import { SessionPicker } from "@/components/dashboard/SessionPicker";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

interface DashboardHeroProps {
  due: number;
  checks: number;
  fresh: number;
  /** Words the user has already learned — gates the Practice/Refresh action. */
  learnedCount?: number;
  /** Daily new-word limit, for the "why is this capped" hint. */
  dailyNewWords?: number;
  /** New words enrolled but held back today by the daily cap (0 = none). */
  newBacklog?: number;
}

/** One breakdown chip: color-matched to its ring segment. */
const SEGMENTS: { key: "due" | "fresh" | "checks"; label: string; dot: string }[] = [
  { key: "due", label: "review", dot: "bg-primary" },
  { key: "fresh", label: "new", dot: "bg-muted-foreground" },
  { key: "checks", label: "checks", dot: "bg-amber" },
];

/**
 * Focus-ring hero: ring shows today's composition, center holds a per-category
 * breakdown (what awaits, not just how many) and a Start button whose href
 * tracks the session-length picker below.
 */
export function DashboardHero({
  due,
  checks,
  fresh,
  learnedCount = 0,
  dailyNewWords = 0,
  newBacklog = 0,
}: DashboardHeroProps) {
  const total = due + checks + fresh;
  const hasCards = total > 0;
  const [href, setHref] = useState("/study?limit=20");
  // Live session size from the picker (null = All / no cap).
  const [size, setSize] = useState<number | null>(null);

  // Practice/refresh reuses the picked session scope, just adds mode=practice.
  const practiceHref = `${href}${href.includes("?") ? "&" : "?"}mode=practice`;
  const canPractice = learnedCount > 0;

  // The ring mirrors what the picked session will actually contain, filled in
  // the same priority order the queue uses: due → checks → new. "All" shows
  // the whole day. Scope (language/list) narrowing is NOT reflected — that
  // would need an extra API call; counts stay global.
  const cap = size ?? total;
  const sessionDue = Math.min(due, cap);
  const sessionChecks = Math.min(checks, Math.max(0, cap - sessionDue));
  const sessionFresh = Math.min(
    fresh,
    Math.max(0, cap - sessionDue - sessionChecks)
  );
  const shown = sessionDue + sessionChecks + sessionFresh;
  const counts = { due: sessionDue, fresh: sessionFresh, checks: sessionChecks };

  const PRACTICE_MODES = [
    { key: "quiz", label: "Daily Quiz", icon: ListChecks },
    { key: "match", label: "Word Match", icon: LayoutGrid },
    { key: "pronounce", label: "Reading Quiz", icon: BookOpen },
    { key: "sentences", label: "Sentences", icon: MessageSquareText },
  ] as const;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full flex-col items-center gap-4 rounded-3xl border bg-card p-6 shadow-card">
        <FocusRing due={sessionDue} checks={sessionChecks} fresh={sessionFresh}>
          {hasCards ? (
            <>
              <span className="text-5xl font-bold tabular-nums leading-none tracking-tight">
                {shown}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">
                {shown === 1 ? "card" : "cards"}
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-semibold">All clear</span>
              <span className="text-xs text-muted-foreground">
                Nothing due now
              </span>
            </>
          )}
        </FocusRing>

        {hasCards ? (
          <>
            {/* One-line breakdown: a dot + count per non-empty category. */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => (
                <span
                  key={s.key}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <span className={cn("size-2 rounded-full", s.dot)} />
                  <span className="font-semibold tabular-nums text-foreground">
                    {counts[s.key]}
                  </span>
                  {s.label}
                </span>
              ))}
            </div>

            <Button asChild size="lg" className="w-full max-w-xs rounded-full">
              <Link href={href}>
                <GraduationCap className="size-4" />
                Start studying
              </Link>
            </Button>

            {/* Session length: a single compact row of chips. */}
            <SessionPicker onHrefChange={setHref} onSizeChange={setSize} />

            {/* Only surfaces when the daily new-word cap is the real limiter —
                explains why a bigger session size shows the same number. */}
            {newBacklog > 0 && (
              <p className="text-center text-[11px] text-muted-foreground">
                {dailyNewWords} new words/day · {newBacklog} more waiting ·{" "}
                <Link
                  href="/settings"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  adjust
                </Link>
              </p>
            )}
          </>
        ) : (
          canPractice ? (
            <Button asChild size="lg" className="w-full max-w-xs rounded-full">
              <Link href={practiceHref}>
                <GraduationCap className="size-4" />
                Refresh learned words
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full max-w-xs rounded-full">
              <Link href="/lists">
                <BookOpen className="size-4" />
                Browse word lists
              </Link>
            </Button>
          )
        )}
      </div>

      {/* Specialized practice — same session query, different screen. */}
      {(hasCards || canPractice) && (
        <div className="w-full max-w-sm space-y-2">
          <SectionLabel>More ways to practice</SectionLabel>
          <p className="text-xs text-muted-foreground">
            Pressure-free games with words you&apos;ve already learned — they
            never change your review schedule.
          </p>
          {PRACTICE_MODES.map(({ key, label, icon: Icon }) => {
            // The games are pure practice: they always draw from already-learned
            // words and never disturb the review schedule, so they keep working
            // after the daily cap is hit.
            let practiceModeHref = href.replace(/^\/study/, `/study/${key}`);
            practiceModeHref += `${practiceModeHref.includes("?") ? "&" : "?"}mode=practice`;
            return (
              <Link
                key={key}
                href={practiceModeHref}
                className="flex items-center gap-3 rounded-2xl border border-dashed bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
