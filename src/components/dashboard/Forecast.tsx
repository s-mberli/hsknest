"use client";

import { motion } from "framer-motion";

/** 7 mini bars: reviews coming due over the next 7 days (index 0 = today). */
export function Forecast({ forecast }: { forecast: number[] }) {
  const max = Math.max(1, ...forecast);
  const today = new Date();

  const days = forecast.map((count, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    // "Today"/"Tmrw" anchor the timeline for new users; weekday letters after.
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Tmrw"
          : d.toLocaleDateString(undefined, { weekday: "narrow" });
    return { count, label, isToday: i === 0 };
  });

  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        {days.map((day, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center gap-1.5"
            title={`${day.count} ${day.count === 1 ? "review" : "reviews"}`}
          >
            <div className="flex h-16 w-full flex-col items-center justify-end gap-0.5">
              {day.count > 0 && (
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                  {day.count}
                </span>
              )}
              <motion.div
                className="w-3 sm:w-4 rounded-t bg-primary/70"
                style={{ minHeight: 2 }}
                initial={{ height: 0 }}
                animate={{ height: `${(day.count / max) * 80}%` }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
              />
            </div>
            <span
              className={
                day.isToday
                  ? "text-[11px] font-semibold text-foreground"
                  : "text-[11px] text-muted-foreground"
              }
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground/80">
        Reviews come back on a schedule — gaps are normal and mean the app
        thinks you&apos;ll still remember.
      </p>
    </div>
  );
}
