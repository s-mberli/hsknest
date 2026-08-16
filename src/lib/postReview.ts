import { toast } from "sonner";

export interface PostReviewOptions {
  /** Grade logged for schedule advancement, not just streak/stats. */
  practice?: boolean;
  /** Source mode: "srs" (default), "quiz", "match", "sentences", "ninja". */
  source?: "srs" | "quiz" | "match" | "sentences" | "ninja";
  /** Response time in milliseconds (null for untimed modes). */
  latencyMs?: number;
  /** Called once the review is durably saved (first try or the retry). */
  onSuccess?: () => void;
  /**
   * Called when both the initial post and the retry failed on a *retriable*
   * (network / 5xx) error, so the caller can re-queue the card rather than
   * silently lose the grade. Not called for 4xx (non-retriable) or 404
   * (stale card — dropped intentionally, nothing to re-queue).
   */
  onRequeue?: () => void;
}

/**
 * Post one review grade, with a single retry on transient failure. Used by
 * both the practice modes (quiz/match/sentence — fire-and-forget) and the
 * main flashcard deck (useStudySession), which supplies `onSuccess`/
 * `onRequeue` to hook the shared retry logic into its own session state
 * (activation tracking, optimistic requeue) without duplicating the fetch.
 *
 * `practice: true` logs the grade to ReviewLog (retained for future FSRS
 * parameter fitting) but does NOT advance the SRS schedule (no interval/
 * dueAt/cap change), and is deliberately excluded from streak and lifetime
 * stats (see stats.ts's `source: "srs"` filters) — a practice-mode session
 * should not read as real review work.
 */
export async function postReview(
  wordId: string,
  quality: number,
  practiceOrOptions: boolean | PostReviewOptions = false
) {
  const opts: PostReviewOptions =
    typeof practiceOrOptions === "boolean"
      ? { practice: practiceOrOptions }
      : practiceOrOptions;

  const body = JSON.stringify({
    wordId,
    quality,
    ...(opts.practice ? { practice: true } : {}),
    ...(opts.source ? { source: opts.source } : {}),
    ...(opts.latencyMs ? { latencyMs: opts.latencyMs } : {}),
  });
  const post = () =>
    fetch("/api/study/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

  try {
    const res = await post();
    if (res.ok) {
      opts.onSuccess?.();
      return;
    }
    // Stale card (progress wiped elsewhere): drop silently, no requeue.
    if (res.status === 404) return;
    // 429 (rate limited) is retriable — a burst of practice-mode traffic
    // can trip the limiter even with its own bucket (see route.ts), and an
    // SRS grade must not be dropped just because the window was momentarily
    // full. Falls through to the retry below instead of returning here.
    // Every other 4xx: client/validation error, non-retriable.
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      try {
        const errorData = await res.json();
        toast.error("Review failed: " + (errorData.error || "Invalid input"));
      } catch {
        toast.error("Review failed: Invalid input");
      }
      return;
    }
    // 5xx: server error, retriable — falls through below.
  } catch {
    // Network error — falls through to retry below.
  }

  await new Promise((r) => setTimeout(r, 1500));
  try {
    const retry = await post();
    if (retry.ok) {
      opts.onSuccess?.();
      return;
    }
    if (retry.status === 404) return;
  } catch {
    // ignored — requeue + toast below
  }
  opts.onRequeue?.();
  toast.error("Couldn't save that review — we'll ask again.");
}
