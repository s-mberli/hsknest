"use client";

import { GraduationCap, LayoutGrid, ListChecks, Volume2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FocusRing } from "@/components/dashboard/FocusRing";
import { SessionPicker } from "@/components/dashboard/SessionPicker";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex flex-col items-center gap-5">
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

      {hasCards && (
        <>
          <SessionPicker onHrefChange={setHref} onSizeChange={setSize} />
          <p className="text-center text-[11px] text-muted-foreground">
            The ring shows what this session will contain. How many new words
            appear per day is set in Settings → Daily workload.
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

      {/* Alternative practice modes — same session query, different screen. */}
      {hasCards && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Or practice with</span>
          <Link
            href={href.replace(/^\/study/, "/study/quiz")}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-foreground underline-offset-4 hover:underline"
          >
            <ListChecks className="size-3.5" />
            Quiz
          </Link>
          <span>·</span>
          <Link
            href={href.replace(/^\/study/, "/study/match")}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-foreground underline-offset-4 hover:underline"
          >
            <LayoutGrid className="size-3.5" />
            Match
          </Link>
          <span>·</span>
          <Link
            href={href.replace(/^\/study/, "/study/pronounce")}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-foreground underline-offset-4 hover:underline"
          >
            <Volume2 className="size-3.5" />
            Pronounce
          </Link>
        </div>
      )}
    </div>
  );
}
