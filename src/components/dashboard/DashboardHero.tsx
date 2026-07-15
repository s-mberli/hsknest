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

import { FocusRing } from "@/components/dashboard/FocusRing";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

interface DashboardHeroProps {
  due: number;
  checks: number;
  fresh: number;
  /** Words the user has already learned — gates the Practice/Refresh action. */
  learnedCount?: number;
  /** Daily new-word limit, for the "how fast do I grow" hint. */
  dailyNewWords?: number;
  /** New words enrolled but held back today by the daily cap (0 = none). */
  newBacklog?: number;
  /** Target language code — gates modes that only make sense per language. */
  languageCode?: string;
  /** Whether the target language has example sentences (gates Sentences mode). */
  hasSentences?: boolean;
}

// Languages whose reading is a learnable romanization (e.g. pinyin), where a
// "pick the reading" quiz is meaningful. For IPA-based readings (de/en/es) it
// would just be "pick the phonetic spelling" — not worth quizzing, so hidden.
const ROMANIZED_READING_LANGS = new Set(["zh"]);

/** One breakdown chip: color-matched to its ring segment. */
const SEGMENTS: { key: "due" | "fresh" | "checks"; label: string; dot: string }[] = [
  { key: "due", label: "review", dot: "bg-primary" },
  { key: "fresh", label: "new", dot: "bg-muted-foreground" },
  { key: "checks", label: "checks", dot: "bg-amber" },
];

// Studying always runs today's whole queue (all due + checks + capped new);
// 500 is the effective "all" cap shared with the queue route.
const STUDY_HREF = "/study?limit=500";
const PRACTICE_HREF = "/study?mode=practice&limit=500";

/**
 * Focus-ring hero: the ring shows exactly today's queue (due → checks → new),
 * a per-category breakdown of what awaits, and a single Start button. How many
 * new words enter per day is a Settings lever, surfaced as a quiet hint — no
 * per-session length picker to second-guess.
 */
export function DashboardHero({
  due,
  checks,
  fresh,
  learnedCount = 0,
  dailyNewWords = 0,
  newBacklog = 0,
  languageCode,
  hasSentences = false,
}: DashboardHeroProps) {
  const total = due + checks + fresh;
  const hasCards = total > 0;
  const canPractice = learnedCount > 0;
  const counts = { due, fresh, checks };

  const showReadingQuiz = languageCode
    ? ROMANIZED_READING_LANGS.has(languageCode)
    : false;

  const PRACTICE_MODES = [
    { key: "quiz", label: "Meaning Quiz", icon: ListChecks },
    { key: "match", label: "Word Match", icon: LayoutGrid },
    ...(showReadingQuiz
      ? [{ key: "pronounce", label: "Reading Quiz", icon: BookOpen } as const]
      : []),
    ...(hasSentences
      ? [{ key: "sentences", label: "Sentences", icon: MessageSquareText } as const]
      : []),
  ] as const;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full flex-col items-center gap-4 rounded-3xl border bg-card p-6 shadow-card">
        <FocusRing due={due} checks={checks} fresh={fresh}>
          {hasCards ? (
            <>
              <span className="text-5xl font-bold tabular-nums leading-none tracking-tight">
                {total}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">
                {total === 1 ? "card" : "cards"}
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
              <Link href={STUDY_HREF}>
                <GraduationCap className="size-4" />
                Start studying
              </Link>
            </Button>

            {/* The real "how fast do I grow" lever lives in Settings. */}
            {dailyNewWords > 0 && (
              <p className="text-center text-[11px] text-muted-foreground">
                {dailyNewWords} new words/day
                {newBacklog > 0 && ` · ${newBacklog} more waiting`} ·{" "}
                <Link
                  href="/settings"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  adjust
                </Link>
              </p>
            )}
          </>
        ) : canPractice ? (
          <Button asChild size="lg" className="w-full max-w-xs rounded-full">
            <Link href={PRACTICE_HREF}>
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
        )}
      </div>

      {/* Specialized practice — pure practice, never moves the schedule. */}
      {(hasCards || canPractice) && (
        <div className="w-full max-w-sm space-y-2">
          <SectionLabel>More ways to practice</SectionLabel>
          <p className="text-xs text-muted-foreground">
            Pressure-free games with words you&apos;ve already learned — they
            never change your review schedule.
          </p>
          {PRACTICE_MODES.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              href={`/study/${key}?mode=practice`}
              className="flex items-center gap-3 rounded-2xl border border-dashed bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="flex-1">{label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
