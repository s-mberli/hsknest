"use client";

import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMutateAction } from "@/hooks/useMutateAction";

interface EnrollResponse {
  enrolled: number;
  alreadyTracked: number;
}

export function EnrollButton({
  listId,
  allEnrolled,
}: {
  listId: string;
  allEnrolled: boolean;
}) {
  const { loading, run } = useMutateAction();

  function enroll() {
    void run<EnrollResponse>(
      () => fetch(`/api/lists/${listId}/enroll`, { method: "POST" }),
      {
        errorMessage: "Could not add these words. Please try again.",
        catchMessage: "Could not add these words — check your connection.",
        onSuccess: (data) => {
          if (data.enrolled > 0) {
            toast.success(
              data.alreadyTracked > 0
                ? `Added ${data.enrolled} words — ${data.alreadyTracked} were already in your queue from another list.`
                : `Added ${data.enrolled} words to your queue.`
            );
          } else {
            toast.info("You already have all of these words.");
          }
        },
      }
    );
  }

  if (allEnrolled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground">
        <Check className="size-4" />
        All words added
      </span>
    );
  }

  return (
    <Button
      onClick={enroll}
      disabled={loading}
      title="Puts these words into your daily study rotation."
    >
      {loading ? "Adding…" : "Add this list to my queue"}
    </Button>
  );
}
