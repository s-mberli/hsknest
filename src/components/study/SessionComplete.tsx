"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface SessionCompleteProps {
  reviewed: number;
  correct: number;
  bestCombo: number;
  elapsedMs: number;
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export function SessionComplete({
  reviewed,
  correct,
  bestCombo,
  elapsedMs,
}: SessionCompleteProps) {
  const accuracy = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0;
  const accuracyTint =
    accuracy >= 80
      ? "text-success"
      : accuracy >= 50
        ? "text-amber"
        : "text-destructive";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <CheckCircle2 className="size-14 text-primary" />
      <h2 className="text-2xl font-bold tracking-tight">Session complete</h2>
      <p className="text-muted-foreground">
        You reviewed {reviewed} {reviewed === 1 ? "card" : "cards"}. Nice work.
      </p>

      <div className="mt-2 grid w-full max-w-xs grid-cols-3 gap-3">
        <Stat label="Accuracy" value={`${accuracy}%`} valueClassName={accuracyTint} />
        <Stat label="Best combo" value={String(bestCombo)} />
        <Stat label="Time" value={formatElapsed(elapsedMs)} />
      </div>

      <div className="mt-4 flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/lists">Add more words</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className={`text-xl font-bold tabular-nums ${valueClassName ?? ""}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
