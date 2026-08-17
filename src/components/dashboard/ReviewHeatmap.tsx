"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface DayData {
  date: string; // YYYY-MM-DD
  count: number;
  correct: number;
}

interface ReviewHeatmapProps {
  days: DayData[];
  totalReviews: number;
  streakDays: number;
}

/**
 * GitHub-style contribution heatmap for review activity. 6-month window,
 * vermilion color scale matching the ink/paper identity.
 *
 * Follows the same day-bucketing as computeStreak (startOfLocalDay) so
 * the heatmap and the streak flame always agree on which day "today" is.
 */
export function ReviewHeatmap({ days, totalReviews, streakDays }: ReviewHeatmapProps) {
  const [selected, setSelected] = useState<DayData | null>(null);
  const [today] = useState(todayStr);

  // Build a lookup map: date → { count, correct }
  const dayMap = new Map<string, DayData>();
  for (const d of days) {
    dayMap.set(d.date, d);
  }

  // Generate the last 180 days of cells, grouped by week (column).
  const weeks = buildWeeks(180);

  // Rolling average over visible window (total ÷ days in range), not per active day.
  const avgPerDay = Math.round(totalReviews / 180);

  return (
    <Card className="relative">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Review activity
          </p>
          <span className="text-xs text-muted-foreground">
            {totalReviews.toLocaleString()} reviews · {avgPerDay}/day
          </span>
        </div>

        <div className="flex gap-2">
          {/* Day labels: Mon, Wed, Fri */}
          <div className="flex flex-col gap-[3px] pt-0">
            {["Mon", "", "Wed", "", "Fri", "", ""].map((label, i) => (
              <span key={i} className="h-3 text-[10px] leading-3 text-muted-foreground">
                {label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((date, di) => {
                    const d = dayMap.get(date);
                    const count = d?.count ?? 0;
                    const isToday = date === today;
                    return (
                      <button
                        key={di}
                        type="button"
                        title={d ? `${d.count} review${d.count !== 1 ? "s" : ""} on ${date}` : date}
                        onClick={() => setSelected(d ?? null)}
                        className={cn(
                          "h-3 w-3 rounded-[2px] border transition-colors",
                          heatColor(count),
                          isToday && "ring-1 ring-primary"
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Month labels */}
            <div className="mt-1 flex gap-[3px]">
              {weeks.map((week, wi) => {
                const firstDate = week[0];
                const month = firstDate
                  ? new Date(firstDate + "T12:00:00").toLocaleDateString("en-US", { month: "short" })
                  : "";
                // Show month label only on the first week of each month.
                const showMonth = wi === 0 || (firstDate && month !== new Date(weeks[wi - 1][0] + "T12:00:00").toLocaleDateString("en-US", { month: "short" }));
                return (
                  <span key={wi} className="h-3 w-3 text-[10px] leading-3 text-muted-foreground">
                    {showMonth ? month : ""}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Streak + legend */}
        <div className="mt-3 flex items-center justify-between">
          {streakDays > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-2.5 py-0.5 text-xs font-medium text-amber">
              <span className="size-1.5 rounded-full bg-amber" />
              {streakDays}-day streak
            </span>
          ) : (
            <span />
          )}
          {/* Color legend */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Less</span>
            {[0, 3, 10, 20].map((count) => (
              <span
                key={count}
                className={cn("h-2.5 w-2.5 rounded-[1px]", heatColor(count))}
              />
            ))}
            <span>More</span>
          </div>
        </div>

        {/* Click popover */}
        {selected && selected.count > 0 && (
          <div className="mt-3 rounded-lg border bg-muted/50 p-3">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">{selected.date}</p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                close
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {selected.count} review{selected.count !== 1 ? "s" : ""} · {selected.correct} correct · {selected.count - selected.correct} lapses
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Color scale: empty cells barely visible, filled cells pop. */
function heatColor(count: number): string {
  if (count === 0) return "bg-border/20";
  if (count <= 5) return "bg-primary/25 border-primary/20";
  if (count <= 15) return "bg-primary/50 border-primary/40";
  return "bg-primary border-primary";
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Build 6 months of weeks. Each week = array of YYYY-MM-DD strings (Mon-Sun). */
function buildWeeks(daysBack: number): string[][] {
  const weeks: string[][] = [];
  const end = new Date();
  // Start from today, go back daysBack days.
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack + 1);

  // Align start to Monday.
  const dayOfWeek = start.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  start.setDate(start.getDate() - mondayOffset);

  const current = new Date(start);
  while (current <= end) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(current);
      d.setDate(d.getDate() + i);
      week.push(fmt(d));
    }
    weeks.push(week);
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
