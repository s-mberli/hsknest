import { toast } from "sonner";

/**
 * Post one review grade, with a single retry on transient failure.
 * Fire-and-forget for practice modes (quiz/match); the flashcard deck has its
 * own richer requeue logic in useStudySession.
 */
export async function postReview(wordId: string, quality: number) {
  const body = JSON.stringify({
    wordId,
    quality,
    reviewedAt: new Date().toISOString(),
  });
  const post = () =>
    fetch("/api/study/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

  try {
    const res = await post();
    if (res.ok || res.status === 404) return;
    // 4xx: client/validation error, non-retriable
    if (res.status >= 400 && res.status < 500) {
      try {
        const errorData = await res.json();
        toast.error("Review failed: " + (errorData.error || "Invalid input"));
      } catch {
        toast.error("Review failed: Invalid input");
      }
      return;
    }
    // 5xx: server error, retriable
  } catch {
    // fall through to retry
  }
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const retry = await post();
    if (retry.ok || retry.status === 404) return;
  } catch {
    // ignored — toast below
  }
  toast.error("Couldn't save that answer.");
}
