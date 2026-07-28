"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function EnrollButton({
  listId,
  allEnrolled,
}: {
  listId: string;
  allEnrolled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function enroll() {
    setLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}/enroll`, { method: "POST" });
      if (!res.ok) {
        toast.error("Could not add these words. Please try again.");
        return;
      }
      const data = await res.json();
      if (data.enrolled > 0) {
        toast.success(
          data.alreadyTracked > 0
            ? `Added ${data.enrolled} words — ${data.alreadyTracked} were already in your queue from another list.`
            : `Added ${data.enrolled} words to your queue.`
        );
      } else {
        toast.info("You already have all of these words.");
      }
      router.refresh();
    } catch {
      toast.error("Could not add these words — check your connection.");
    } finally {
      setLoading(false);
    }
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
