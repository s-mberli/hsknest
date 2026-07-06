"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function AssumeButton({ listId }: { listId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function assume() {
    setLoading(true);
    const res = await fetch(`/api/lists/${listId}/assume`, { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      toast.error("Could not update these words. Please try again.");
      return;
    }
    const data = await res.json();
    if (data.assumed > 0) {
      toast.success(`Marked ${data.assumed} words as already known.`);
    } else {
      toast.info("Nothing to mark — these are already tracked.");
    }
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      onClick={assume}
      disabled={loading}
      title="Sets these aside as known — they'll be spot-checked occasionally instead of studied daily."
    >
      {loading ? "Saving…" : "I already know these"}
    </Button>
  );
}
