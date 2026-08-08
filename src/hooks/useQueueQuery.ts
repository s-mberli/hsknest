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
  listIds: string[];
} {
  const params = useSearchParams();
  const practice = params.get("mode") === "practice";

  const rawListIds = params.get("listIds");
  const listIds = rawListIds ? rawListIds.split(",").filter(Boolean) : [];

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

  if (rawListIds) parts.push(`listIds=${encodeURIComponent(rawListIds)}`);
  if (practice) parts.push("mode=practice");

  return {
    query: parts.join("&"),
    scoped: listIds.length > 0,
    practice,
    listIds,
  };
}
