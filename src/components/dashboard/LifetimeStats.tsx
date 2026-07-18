import { Card, CardContent } from "@/components/ui/card";
import type { LifetimeStats as LifetimeStatsData } from "@/lib/stats";

/**
 * "All time" lifetime stats card — server-rendered, no client JS needed.
 * Mirrors the "Upcoming schedule" card's eyebrow/hint pattern.
 */
export function LifetimeStats({ stats }: { stats: LifetimeStatsData }) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            All time
          </p>
          <span className="text-[11px] text-muted-foreground">
            since your first review
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold tabular-nums">{stats.reviews}</p>
            <p className="text-sm text-muted-foreground">reviews answered</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{stats.daysStudied}</p>
            <p className="text-sm text-muted-foreground">days studied</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-success">
              {stats.recallRate}%
            </p>
            <p className="text-sm text-muted-foreground">recall rate</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {stats.wordsPerDay}
              <span className="text-base font-normal text-muted-foreground">/day</span>
            </p>
            <p className="text-sm text-muted-foreground">words learned</p>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Recall rate is the share of graded reviews you remembered — flashcards
          and practice rounds alike.
        </p>
      </CardContent>
    </Card>
  );
}
