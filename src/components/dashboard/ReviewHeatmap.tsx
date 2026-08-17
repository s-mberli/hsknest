"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface DayData {
  date: string; // YYYY-MM-DD
  count: number;
  correct: number;
}

interface ReviewHeatmapProps {
  days: DayData[];
  streakDays: number;
}

/** Cell size in px. CSS Grid auto-fill handles responsiveness. */
const CELL = 14;

/**
 * GitHub-style contribution heatmap for review activity. Responsive —
 * CSS Grid auto-fill creates as many 14px columns as fit the container.
 * No ResizeObserver, no fixed week count, no overflow. Works on any width.
 */
export function ReviewHeatmap({ days, streakDays }: ReviewHeatmapProps) {
  const [selected, setSelected] = useState<DayData | null>(null);
  const [today] = useState(todayStr);

  // All dates: 1 year, Mon-aligned.
  const allDates = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 364);
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(fmt(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }, []);

  // Month labels: which months appear in the grid data.
  const monthLabels = useMemo(() => {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const date of allDates) {
      const month = new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short" });
      if (!seen.has(month)) {
        seen.add(month);
        labels.push(month);
      }
    }
    return labels;
  }, [allDates]);
    const m = new Map<string, DayData>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Review activity
      </p>

      {/* Grid — auto-fill creates as many 14px columns as fit. No overflow. */}
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(auto-fill, ${CELL}px)` }}
      >
        {allDates.map((date, i) => {
          const d = dayMap.get(date);
          const count = d?.count ?? 0;
          const isToday = date === today;
          return (
            <button
              key={i}
              type="button"
              title={d ? `${d.count} review${d.count !== 1 ? "s" : ""} on ${date}` : date}
              onClick={() => setSelected(d ?? null)}
              className={cn(
                "rounded-[2px] border transition-colors",
                heatColor(count),
                isToday && "ring-1 ring-primary"
              )}
              style={{ width: CELL, height: CELL }}
            />
          );
        })}
      </div>

      {/* Month labels legend */}
      <div className="flex justify-center gap-2 text-[10px] text-muted-foreground">
        {monthLabels.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>

      {/* Legend + streak */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>Less</span>
          {[0, 3, 10, 20].map((count) => (
            <span
              key={count}
              className={cn("rounded-[1px]", heatColor(count))}
              style={{ width: 10, height: 10 }}
            />
          ))}
          <span>More</span>
        </div>
        {streakDays > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-2.5 py-0.5 text-xs font-medium text-amber">
            <span className="size-1.5 rounded-full bg-amber" />
            {streakDays}-day streak
          </span>
        )}
      </div>

      {/* Click popover */}
      {selected && selected.count > 0 && (
        <div className="rounded-lg border bg-muted/50 p-3">
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
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {selected.count} review{selected.count !== 1 ? "s" : ""}
            </p>
            <p className="text-xs font-medium text-foreground">
              {Math.round((selected.correct / selected.count) * 100)}% correct
            </p>
          </div>
          <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-border/30">
            <div
              className="bg-primary"
              style={{ width: `${(selected.correct / selected.count) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

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

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
