"use client";

import { useSearchParams } from "next/navigation";

/**
 * Build a queue query string from the URL: ?minutes=M wins, else ?limit=N,
 * plus any scope params (?languageId, ?listIds) passed straight through.
 * Shared by the flashcard, quiz, and match screens.
 */
export function useQueueQuery(): {
  query: string;
  scoped: boolean;
  practice: boolean;
} {
  const params = useSearchParams();
  const practice = params.get("mode") === "practice";

  const parts: string[] = [];
  const minutes = Number(params.get("minutes"));
  if (Number.isFinite(minutes) && minutes > 0) {
    parts.push(`minutes=${Math.floor(minutes)}`);
  } else {
    const limit = Number(params.get("limit"));
    parts.push(
      Number.isFinite(limit) && limit > 0
        ? `limit=${Math.floor(limit)}`
        : "limit=20"
    );
  }

  const languageId = params.get("languageId");
  const listIds = params.get("listIds");
  if (languageId) parts.push(`languageId=${encodeURIComponent(languageId)}`);
  if (listIds) parts.push(`listIds=${encodeURIComponent(listIds)}`);
  if (practice) parts.push("mode=practice");

  return {
    query: parts.join("&"),
    scoped: Boolean(languageId || listIds),
    practice,
  };
}
