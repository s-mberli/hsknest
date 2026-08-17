"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

/** Cell size in px. Gap is 3px. Week column width = CELL + GAP = 17px. */
const CELL = 14;
const GAP = 3;
const COL = CELL + GAP;

/**
 * GitHub-style contribution heatmap for review activity. Responsive —
 * computes the number of weeks from container width so the grid fills
 * available space on both desktop and mobile without overflow or scroll.
 *
 * Cell size: 14px. Vermilion color scale matching ink/paper identity.
 */
export function ReviewHeatmap({ days, streakDays }: ReviewHeatmapProps) {
  const [selected, setSelected] = useState<DayData | null>(null);
  const [today] = useState(todayStr);
  const containerRef = useRef<HTMLDivElement>(null);
  const [numWeeks, setNumWeeks] = useState(26); // default, updated by ResizeObserver

  // Build lookup map: date → data
  const dayMap = useMemo(() => {
    const m = new Map<string, DayData>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  // All dates in the grid (most-recent N weeks, Mon-aligned).
  const allDates = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - numWeeks * 7 + 1);
    // Align to Monday.
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));

    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(fmt(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }, [numWeeks]);

  // Measure container → compute how many weeks fit.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      if (w > 0) setNumWeeks(Math.max(4, Math.floor(w / COL)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Month labels — computed from the visible dates.
  const monthLabels = useMemo(() => {
    const labels: { month: string; index: number }[] = [];
    let lastMonth = "";
    for (let i = 0; i < allDates.length; i += 7) {
      const d = allDates[i];
      const month = d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short" }) : "";
      if (month && month !== lastMonth) {
        labels.push({ month, index: i });
        lastMonth = month;
      }
    }
    return labels;
  }, [allDates]);

  // Columns: each column is a day (Mon→Sun). 7 rows.
  const columns = useMemo(() => {
    const cols: string[][] = [];
    for (let i = 0; i < allDates.length; i += 7) {
      cols.push(allDates.slice(i, i + 7));
    }
    return cols;
  }, [allDates]);

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Review activity
      </p>

      {/* Responsive grid — fills available width */}
      <div ref={containerRef}>
        {/* Month labels */}
        <div className="flex gap-[3px]">
          {columns.map((col, ci) => {
            const ml = monthLabels.find((m) => m.index === ci * 7);
            return (
              <span key={ci} className="h-3 w-3.5 text-[10px] leading-3 text-muted-foreground">
                {ml?.month ?? ""}
              </span>
            );
          })}
        </div>

        {/* Day grid — CSS Grid with fixed cell size */}
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${columns.length}, ${CELL}px)` }}
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
