"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { heatmapWeeks, localDate } from "@/lib/heatmapDates";

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
  const router = useRouter();
  const [selected, setSelected] = useState<DayData | null>(null);
  const [today, setToday] = useState("");
  const todayRef = useRef("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [numWeeks, setNumWeeks] = useState(26);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const current = localDate(new Date());
      if (todayRef.current && todayRef.current !== current) router.refresh();
      todayRef.current = current;
      setToday(current);
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

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
    return today ? heatmapWeeks(today, numWeeks) : [];
  }, [today, numWeeks]);

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
                  const future = date > today;
                  const label = future
                    ? `${date}: future date`
                    : d
                      ? dayTitle(d, date)
                      : date;
                  return (
                    <button
                      key={di}
                      type="button"
                      aria-label={label}
                      title={future ? undefined : label}
                      disabled={future}
                      onClick={() => setSelected(d ?? null)}
                      className={cn(
                        "h-3 w-3 rounded-[2px] border transition-colors",
                        future ? "border-transparent bg-transparent" : heatColor(activity),
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
