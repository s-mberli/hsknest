"use client";

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

  return (
    <Button
      onClick={enroll}
      disabled={loading || allEnrolled}
      title="Puts these words into your daily study rotation."
    >
      {allEnrolled
        ? "All words added"
        : loading
          ? "Adding…"
          : "Add all to my queue"}
    </Button>
  );
}
