/**
 * Word strength bands — a display-oriented view over raw SRS state.
 * Pure/derivation only: no I/O, no Prisma types. Given a word's progress
 * snapshot, classify it into one of six memory-strength bands.
 */

export type Strength =
  | "mastered"
  | "solid"
  | "growing"
  | "shaky"
  | "known"
  | "new";

export interface StrengthInput {
  state: string;
  intervalDays: number;
  lapses: number;
}

/** Interval (days) at which a REVIEW card is considered "solid". */
export const SOLID_INTERVAL_DAYS = 21;
/** Lapse count at which any card is dragged down to "shaky". */
export const SHAKY_LAPSES = 3;

/**
 * Map an SRS progress snapshot to a strength band.
 *
 * - MASTERED               → mastered
 * - ASSUMED                → known
 * - NEW                    → new
 * - LAPSED || lapses >= 3  → shaky
 * - REVIEW && interval>=21 → solid
 * - else (LEARNING / young REVIEW) → growing
 */
export function wordStrength(p: StrengthInput): Strength {
  if (p.state === "MASTERED") return "mastered";
  if (p.state === "ASSUMED") return "known";
  if (p.state === "NEW") return "new";
  if (p.state === "LAPSED" || p.lapses >= SHAKY_LAPSES) return "shaky";
  if (p.state === "REVIEW" && p.intervalDays >= SOLID_INTERVAL_DAYS) {
    return "solid";
  }
  return "growing";
}

/** Display copy per band. */
export const STRENGTH_META: Record<
  Strength,
  { label: string; blurb: string }
> = {
  mastered: {
    label: "Mastered",
    blurb: "Locked into long-term memory. Rarely needs review.",
  },
  solid: {
    label: "Solid",
    blurb: "Recalled reliably over long intervals.",
  },
  growing: {
    label: "Growing",
    blurb: "Learning in progress — still on a short schedule.",
  },
  shaky: {
    label: "Trouble",
    blurb: "Forgotten repeatedly. Needs extra attention.",
  },
  known: {
    label: "Known",
    blurb: "Set aside as already known.",
  },
  new: {
    label: "New",
    blurb: "Not studied yet.",
  },
};

/** Stable display order for band sections and filters. */
export const STRENGTH_ORDER: Strength[] = [
  "mastered",
  "solid",
  "growing",
  "shaky",
  "known",
  "new",
];
