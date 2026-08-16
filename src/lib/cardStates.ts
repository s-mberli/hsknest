import type { CardState } from "@/lib/srs";
import { DUE_STATES } from "@/lib/horizon";

/**
 * Single home for the card-state groupings the app counts. Before this
 * module, "learned" was computed three different ways in three places
 * (listSections.ts, stats.ts) and "due" was hand-rolled in listSections.ts
 * while the rest of the app used horizon.ts's DUE_STATES — every one of
 * those could silently drift when a new state was added.
 *
 * Each constant here is a *named, documented metric*. Two of them are
 * intentionally narrower than "anything the scheduler has touched" — that
 * is a product choice, not an accident — but the reason now lives next to
 * the definition instead of buried in a comment at one call site.
 */

/**
 * Anything the scheduler has touched (i.e. not NEW). The list-card rollup's
 * "learned" count (listSections.ts): ASSUMED counts as learned by design —
 * the user said "I know this word".
 */
export const TRACKED_STATES = new Set<CardState>([
  "LEARNING",
  "REVIEW",
  "LAPSED",
  "MASTERED",
  "ASSUMED",
]);

/**
 * Dashboard hero "learned" (stats.ts:getDashboardStats learnedTotal): REVIEW
 * only. Deliberately the strictest definition — the hero shows solid recall,
 * not "has touched the card once". Narrower than TRACKED_STATES on purpose.
 */
export const SOLID_STATES = new Set<CardState>(["REVIEW"]);

/**
 * Lifetime wordsPerDay "learned" denominator (stats.ts:getLifetimeStats):
 * excludes LAPSED (a card currently struggling isn't "learned") and ASSUMED
 * (never actually reviewed). A distinct, documented metric — not the same
 * concept as TRACKED_STATES or SOLID_STATES.
 */
export const LIFETIME_LEARNED_STATES = new Set<CardState>([
  "LEARNING",
  "REVIEW",
  "MASTERED",
]);

/** Re-exported so call sites can grab the canonical due set from one place. */
export { DUE_STATES };
