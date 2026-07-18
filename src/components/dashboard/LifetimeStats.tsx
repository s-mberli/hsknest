import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { LifetimeStats as LifetimeStatsData } from "@/lib/stats";

/**
 * "All time" lifetime stats card — server-rendered, no client JS needed.
 * A tight four-across stat strip (two-up on mobile). `weakCount` is a
 * current-state count, not lifetime, so it lives below the divider as an
 * actionable link rather than mixed into the strip.
 */
export function LifetimeStats({
  stats,
  weakCount = 0,
}: {
  stats: LifetimeStatsData;
  weakCount?: number;
}) {
  const items = [
    { value: stats.reviews.toLocaleString(), label: "reviews" },
    { value: stats.daysStudied.toLocaleString(), label: "days studied" },
    { value: `${stats.recallRate}%`, label: "recall rate" },
    { value: `${stats.wordsPerDay}`, label: "words/day", suffix: true },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            All time
          </p>
          <span className="text-[11px] text-muted-foreground">
            since your first review
          </span>
        </div>

        <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
          {items.map((it) => (
            <div key={it.label}>
              <p className="text-2xl font-bold tabular-nums leading-none">
                {it.value}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{it.label}</p>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
          Recall rate is the share of graded reviews you remembered — flashcards
          and practice rounds alike.
        </p>

        {weakCount > 0 && (
          <Link
            href="/words"
            className="mt-4 flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <span>
              <span className="font-semibold tabular-nums">{weakCount}</span>{" "}
              <span className="text-muted-foreground">
                {weakCount === 1 ? "word needs" : "words need"} another look
              </span>
            </span>
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
