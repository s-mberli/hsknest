"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Per-user hide/restore control on starter-list cards. Hiding never deletes
 * anything — the list just moves to the collapsed "Hidden" section.
 */
export function ListVisibilityButton({
  listId,
  hidden,
}: {
  listId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // The button sits inside the card's <Link>; don't navigate.
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const res = await fetch(`/api/lists/${listId}/hide`, {
      method: hidden ? "DELETE" : "POST",
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not update that list.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={hidden ? "Show this list again" : "Hide this list"}
      title={hidden ? "Show this list again" : "Hide this list"}
      className="rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
    >
      {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
    </button>
  );
}
