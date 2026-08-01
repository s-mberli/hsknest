"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMutateAction } from "@/hooks/useMutateAction";

interface UnenrollResponse {
  removed: number;
}

/**
 * Removes this list's words from the study queue (deletes their progress).
 * Two-step confirm inline — no dialog — since this loses SRS progress.
 */
export function UnenrollButton({
  listId,
  enrolledCount,
}: {
  listId: string;
  enrolledCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const { loading, run } = useMutateAction();

  if (enrolledCount === 0) return null;

  async function unenroll() {
    await run<UnenrollResponse>(
      () => fetch(`/api/lists/${listId}/enroll`, { method: "DELETE" }),
      {
        errorMessage: "Could not remove these words. Please try again.",
        catchMessage: "Could not remove these words — check your connection.",
        onSuccess: (data) => {
          toast.success(`Removed ${data.removed} words from your queue.`);
        },
      }
    );
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Remove {enrolledCount} words? Their review progress is deleted.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={unenroll}
          disabled={loading}
        >
          {loading ? "Removing…" : "Yes, remove"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-destructive/40 text-destructive hover:bg-destructive/10"
      onClick={() => setConfirming(true)}
      title="Takes these words out of your daily study rotation."
    >
      Remove from my queue
    </Button>
  );
}
