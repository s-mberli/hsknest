"use client";

import { motion } from "framer-motion";

/** 7 mini bars: reviews coming due over the next 7 days (index 0 = today). */
export function Forecast({ forecast }: { forecast: number[] }) {
  const max = Math.max(1, ...forecast);
  const today = new Date();

  const days = forecast.map((count, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const initial = d.toLocaleDateString(undefined, { weekday: "narrow" });
    return { count, initial, isToday: i === 0 };
  });

  return (
    <div className="flex items-end justify-between gap-2">
      {days.map((day, i) => (
        <div
          key={i}
          className="flex flex-1 flex-col items-center gap-1.5"
        >
          <div className="flex h-16 w-full items-end">
            <motion.div
              className="w-full rounded-sm bg-primary/70"
              style={{ minHeight: 2 }}
              initial={{ height: 0 }}
              animate={{ height: `${(day.count / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
            />
          </div>
          <span
            className={
              day.isToday
                ? "text-xs font-semibold text-foreground"
                : "text-xs text-muted-foreground"
            }
          >
            {day.initial}
          </span>
        </div>
      ))}
    </div>
  );
}
