import { type PracticeAvailability } from "@/lib/practiceModes";

export type StudyEntryKey = "practice" | "ninja";

export interface StudyEntry {
  key: StudyEntryKey;
  label: string;
  href: string;
  subtitle?: string;
}

/**
 * Supplementary study entries — the ones that show below the primary Study CTA.
 * Consolidates five individual mode tiles into Practice (one entry, mode chosen
 * by Rotation) plus Word Ninja (its own entry, deliberate fast-paced unbounded play).
 *
 * Practice is unavailable for a brand-new learner with no learned words (guards
 * against an empty Practice screen). When no rotatable modes are available
 * (highly unlikely in practice), Practice is omitted but Ninja stays reachable.
 *
 * Rules:
 * - learnedCount === 0 → empty array (brand-new learner).
 * - learnedCount > 0 and rotatable modes exist → Practice entry.
 * - availability.ninja → Ninja entry.
 * - No mode selection by learner — Rotation picks one automatically.
 */
export function getSupplementaryStudyEntries(input: {
  learnedCount: number;
  availability: PracticeAvailability;
}): StudyEntry[] {
  const entries: StudyEntry[] = [];

  // Brand-new learner guard: don't show Practice if no words have been learned.
  if (input.learnedCount === 0) {
    return entries;
  }

  // Practice entry — one round of a rotated mode. Requires at least one
  // rotatable mode. The route guards against empty screens itself; this keeps
  // that contract consistent.
  if (input.availability.rotatable.length > 0) {
    entries.push({
      key: "practice",
      label: "Practice",
      href: "/study/practice?mode=practice&limit=500",
    });
  }

  // Word Ninja — always available when availability.ninja is true, but it is
  // a separate entry, never part of Rotation.
  if (input.availability.ninja) {
    entries.push({
      key: "ninja",
      label: "Word Ninja",
      href: "/study/ninja?mode=practice",
      subtitle: "Fast-paced, motion-heavy",
    });
  }

  return entries;
}
