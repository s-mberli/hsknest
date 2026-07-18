"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Rank chip + up/down controls for a "Studying" list card. Moves the list
 * within `order` (the full current studying-list id order) and PATCHes the
 * whole order to /api/lists/priority — the API always replaces the order
 * wholesale, so the client must send the complete array, not a delta.
 */
export function PriorityControls({
  listId,
  rank,
  order,
}: {
  listId: string;
  /** 1-based display rank. */
  rank: number;
  /** Full ordered list of studying list ids (current order, including this one). */
  order: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const index = order.indexOf(listId);
  const atTop = index <= 0;
  const atBottom = index === order.length - 1 || index === -1;

  async function move(delta: -1 | 1, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy || index === -1) return;
    const target = index + delta;
    if (target < 0 || target >= order.length) return;

    const next = order.slice();
    [next[index], next[target]] = [next[target], next[index]];

    setBusy(true);
    try {
      const res = await fetch("/api/lists/priority", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next }),
      });
      if (!res.ok) {
        toast.error("Could not reorder that list.");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Could not reorder that list — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <span
          className={
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums " +
            (rank === 1
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground")
          }
        >
          {rank}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {rank === 1 ? "Next up" : "in queue"}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => move(-1, e)}
          disabled={busy || atTop}
          aria-label="Move up in queue"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-card"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={(e) => move(1, e)}
          disabled={busy || atBottom}
          aria-label="Move down in queue"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-card"
        >
          <ChevronDown className="size-4" />
        </button>
      </span>
    </div>
  );
}
