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
    if (res.status < 500) {
      toast.error("Couldn't save that answer.");
      return;
    }
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
