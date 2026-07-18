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
    <div className="flex items-center gap-1.5">
      <span
        className={
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
          (rank === 1
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground")
        }
      >
        {rank}
      </span>
      <div className="flex flex-col">
        <button
          type="button"
          onClick={(e) => move(-1, e)}
          disabled={busy || atTop}
          aria-label="Move up"
          className="flex h-[22px] w-11 items-center justify-center rounded-t-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => move(1, e)}
          disabled={busy || atBottom}
          aria-label="Move down"
          className="flex h-[22px] w-11 items-center justify-center rounded-b-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
