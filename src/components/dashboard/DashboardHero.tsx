"use client";

import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  LayoutGrid,
  ListChecks,
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
}

/** One breakdown row: color-matched to its ring segment. */
const SEGMENTS: { key: "due" | "fresh" | "checks"; label: string; className: string }[] = [
  { key: "due", label: "to review", className: "text-primary" },
  { key: "fresh", label: "new words", className: "text-muted-foreground" },
  { key: "checks", label: "known-word checks", className: "text-amber" },
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
  ] as const;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full flex-col items-center rounded-3xl border bg-card p-6 shadow-card">
      <FocusRing due={sessionDue} checks={sessionChecks} fresh={sessionFresh}>
        {hasCards ? (
          <>
            <div className="flex flex-col gap-1">
              {SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => (
                <div key={s.key} className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "text-2xl font-bold tabular-nums leading-none tracking-tight",
                      s.className
                    )}
                  >
                    {counts[s.key]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            <span className="mt-1 text-xs text-muted-foreground">
              Session: {shown} {shown === 1 ? "card" : "cards"}
            </span>
            <Button asChild size="sm" className="mt-1 rounded-full">
              <Link href={href}>
                <GraduationCap className="size-4" />
                Start
              </Link>
            </Button>
          </>
        ) : (
          <>
            <span className="text-2xl font-semibold">All clear</span>
            <span className="text-xs text-muted-foreground">
              Nothing due right now
            </span>
            {canPractice && (
              <Button asChild size="sm" className="mt-2 rounded-full">
                <Link href={practiceHref}>
                  <GraduationCap className="size-4" />
                  Refresh learned words
                </Link>
              </Button>
            )}
          </>
        )}
      </FocusRing>
      </div>

      {hasCards && (
        <>
          <SessionPicker onHrefChange={setHref} onSizeChange={setSize} />
          <p className="text-center text-[11px] text-muted-foreground">
            Ring = this session. New words/day → Settings.
          </p>
          {canPractice && (
            <Link
              href={practiceHref}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              or refresh learned words
            </Link>
          )}
        </>
      )}

      {/* Specialized practice — same session query, different screen. */}
      {(hasCards || canPractice) && (
        <div className="w-full max-w-sm space-y-2">
          <SectionLabel>Specialized practice</SectionLabel>
          {PRACTICE_MODES.map(({ key, label, icon: Icon }) => {
            let practiceModeHref = href.replace(/^\/study/, `/study/${key}`);
            if (!hasCards) {
              practiceModeHref += `${practiceModeHref.includes("?") ? "&" : "?"}mode=practice`;
            }
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
