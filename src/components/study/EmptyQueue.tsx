"use client";

import { Moon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface EmptyQueueProps {
  /** True when the session was narrowed to a language/list selection. */
  scoped: boolean;
}

export function EmptyQueue({ scoped }: EmptyQueueProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <Moon className="size-14 text-primary" />
      <h2 className="text-2xl font-bold tracking-tight">
        Nothing to study right now
      </h2>
      <p className="max-w-sm text-muted-foreground">
        You&apos;re all caught up. Add more words or come back when reviews are
        due.
      </p>

      {scoped && (
        <p className="max-w-sm text-sm text-muted-foreground">
          You&apos;re studying a narrowed selection — clear the scope on the
          dashboard to see everything.
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <Button asChild>
          <Link href="/lists">Browse word lists</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
