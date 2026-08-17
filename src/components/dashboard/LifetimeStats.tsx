import { Card, CardContent } from "@/components/ui/card";
import type { LifetimeStats as LifetimeStatsData } from "@/lib/stats";

/**
 * "All time" lifetime stats card — server-rendered, no client JS needed.
 * A tight four-across stat strip (two-up on mobile).
 */
export function LifetimeStats({
  stats,
}: {
  stats: LifetimeStatsData;
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

      </CardContent>
    </Card>
  );
}
