"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface DayData {
  date: string; // YYYY-MM-DD
  count: number;
  correct: number;
  /** Reading sessions that day. Separate from `count`/`correct` (reviews)
   * since a reading session has no correctness to report — see
   * src/lib/readingActivity.ts. */
  readingCount?: number;
}

interface ReviewHeatmapProps {
  days: DayData[];
  streakDays: number;
}

/** Cell size: 12px (same as initial version). Gap: 3px. Column width: 15px. */
const CELL = 12;
const GAP = 3;
const COL = CELL + GAP;

/**
 * GitHub-style contribution heatmap. Same structure as the initial version
 * (flex columns, day labels, month labels, 12px cells) — the ONLY change
 * is a ResizeObserver that computes how many weeks fit the container,
 * so the grid fills available space on desktop and mobile without overflow.
 */
export function ReviewHeatmap({ days, streakDays }: ReviewHeatmapProps) {
  const [selected, setSelected] = useState<DayData | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [numWeeks, setNumWeeks] = useState(26);
  const [ready, setReady] = useState(false);

  // Set today only after hydration (SSR uses server UTC, not client local).
  // eslint-disable-next-line -- suppress setState-in-effect for one-time hydration
  useEffect(() => setMounted(true), []);
  const today = mounted ? todayStr() : "";

  // All dates: 1 year (365 days), Mon-aligned.
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

  const dayMap = useMemo(() => {
    const m = new Map<string, DayData>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  // Measure container → compute how many week columns fit.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) {
        setNumWeeks(Math.max(4, Math.min(52, Math.floor(w / COL))));
        setReady(true);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Weeks: most recent numWeeks columns, each = 7 days (Mon–Sun).
  const weeks = useMemo(() => {
    const totalWeeks = Math.floor(allDates.length / 7);
    const startWeek = Math.max(0, totalWeeks - numWeeks);
    const out: string[][] = [];
    for (let w = startWeek; w < totalWeeks; w++) {
      out.push(allDates.slice(w * 7, w * 7 + 7));
    }
    return out;
  }, [allDates, numWeeks]);

  // Month labels: show on first week of each new month.
  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    let lastMonth = "";
    for (const week of weeks) {
      const d = week[0];
      const month = d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short" }) : "";
      if (month && month !== lastMonth) {
        labels.push(month);
        lastMonth = month;
      } else {
        labels.push("");
      }
    }
    return labels;
  }, [weeks]);

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Review activity
      </p>

      <div className="flex gap-2">
        {/* Day labels: Mon, Wed, Fri, Sun */}
        <div className="flex flex-col gap-[3px] pt-0">
          {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((label, i) => (
            <span key={i} className="h-3 text-[10px] leading-3 text-muted-foreground">
              {label}
            </span>
          ))}
        </div>

        {/* Grid — flex columns, render only after measurement */}
        <div ref={containerRef} className="flex-1 overflow-x-auto overflow-y-hidden">
          {ready && (
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((date, di) => {
                  const d = dayMap.get(date);
                  const activity = (d?.count ?? 0) + (d?.readingCount ?? 0);
                  const isToday = date === today;
                  return (
                    <button
                      key={di}
                      type="button"
                      title={d ? dayTitle(d, date) : date}
                      onClick={() => setSelected(d ?? null)}
                      className={cn(
                        "h-3 w-3 rounded-[2px] border transition-colors",
                        heatColor(activity),
                        isToday && "ring-1 ring-primary"
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          )}
          {/* Month labels — aligned to week columns */}
          {ready && (
          <div className="mt-1 flex gap-[3px]">
            {monthLabels.map((label, i) => (
              <span key={i} className="w-3 text-[10px] leading-3 text-muted-foreground">
                {label}
              </span>
            ))}
          </div>
          )}
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
      {selected && (selected.count > 0 || (selected.readingCount ?? 0) > 0) && (
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
          {selected.count > 0 && (
            <>
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
            </>
          )}
          {(selected.readingCount ?? 0) > 0 && (
            <p className={cn("text-xs text-muted-foreground", selected.count > 0 && "mt-2")}>
              {selected.readingCount} reading session{selected.readingCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function dayTitle(d: DayData, date: string): string {
  const parts: string[] = [];
  if (d.count > 0) parts.push(`${d.count} review${d.count !== 1 ? "s" : ""}`);
  if ((d.readingCount ?? 0) > 0) parts.push(`${d.readingCount} reading session${d.readingCount !== 1 ? "s" : ""}`);
  return parts.length > 0 ? `${parts.join(", ")} on ${date}` : date;
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
