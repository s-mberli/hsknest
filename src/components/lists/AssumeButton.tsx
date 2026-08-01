"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMutateAction } from "@/hooks/useMutateAction";

interface AssumeResponse {
  assumed: number;
}

export function AssumeButton({ listId }: { listId: string }) {
  const { loading, run } = useMutateAction();

  function assume() {
    void run<AssumeResponse>(
      () => fetch(`/api/lists/${listId}/assume`, { method: "POST" }),
      {
        errorMessage: "Could not update these words. Please try again.",
        catchMessage: "Could not update these words — check your connection.",
        onSuccess: (data) => {
          if (data.assumed > 0) {
            toast.success(`Marked ${data.assumed} words as already known.`);
          } else {
            toast.info("Nothing to mark — these are already tracked.");
          }
        },
      }
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={assume}
      disabled={loading}
      title="Sets these aside as known — they'll be spot-checked occasionally instead of studied daily."
    >
      {loading ? "Saving…" : "I already know these"}
    </Button>
  );
}
