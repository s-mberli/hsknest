/**
 * simulate-schedule.ts — pure scheduler simulation. NO database access.
 *
 * Imports the REAL strategies from src/lib/srs/ (sm2.ts, leitner.ts,
 * modifiers.ts) — identical code paths to production, so output is ground
 * truth for "what interval would the app compute".
 *
 * Usage:
 *   npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/simulate-schedule.ts <SM2|LEITNER> <grades> [options]
 *
 *   <grades>  comma-separated 0-5 qualities, e.g. 4,4,2,5
 *   Options (all optional):
 *     --intervalModifier=<float>    default 1.0
 *     --lapseModifier=<float>       default 0.0
 *     --masteryThresholdDays=<int>  default none (never master)
 *     --fuzz                        enable +/-5% fuzz (default OFF here so
 *                                   output is deterministic; the app default is ON)
 *
 * Each simulated review happens exactly when the card comes due (time is
 * advanced by the previous interval), which is the idealized "perfect
 * student" assumption.
 */
import {
  applyUserModifiers,
  getAlgorithm,
  type ReviewQuality,
  type SRSAlgorithmType,
  type UserSRSPrefs,
} from "../../../../src/lib/srs/index";
import { printTable } from "./_shared";

const [algoArg, gradesArg, ...rest] = process.argv.slice(2);
if (!algoArg || !gradesArg) {
  console.error(
    "Usage: npx tsx .claude/skills/recall-diagnostics-toolkit/scripts/simulate-schedule.ts <SM2|LEITNER> <grades e.g. 4,4,2,5> [--intervalModifier=1.2] [--lapseModifier=0.5] [--masteryThresholdDays=180] [--fuzz]"
  );
  process.exit(1);
}

const algoType = algoArg.toUpperCase() as SRSAlgorithmType;
if (algoType !== "SM2" && algoType !== "LEITNER") {
  console.error(`Unknown algorithm "${algoArg}" — use SM2 or LEITNER.`);
  process.exit(1);
}

const grades = gradesArg.split(",").map((g) => {
  const n = Number(g.trim());
  if (!Number.isInteger(n) || n < 0 || n > 5) {
    console.error(`Invalid grade "${g}" — grades must be integers 0-5.`);
    process.exit(1);
  }
  return n as ReviewQuality;
});

function opt(name: string, fallback: number): number {
  const hit = rest.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
}
const prefs: UserSRSPrefs = {
  intervalModifier: opt("intervalModifier", 1.0),
  lapseModifier: opt("lapseModifier", 0.0),
  masteryThresholdDays: rest.some((a) => a.startsWith("--masteryThresholdDays="))
    ? opt("masteryThresholdDays", 0)
    : null,
  fuzzIntervals: rest.includes("--fuzz"),
};

const algo = getAlgorithm(algoType);
// Fixed clock for reproducible output.
let now = new Date("2026-07-07T00:00:00.000Z");
let state = algo.initialState(now);

console.log(
  `Algorithm: ${algoType}  prefs: intervalModifier=${prefs.intervalModifier} lapseModifier=${prefs.lapseModifier} masteryThresholdDays=${prefs.masteryThresholdDays ?? "null"} fuzz=${prefs.fuzzIntervals}`
);
console.log(`Grades: ${grades.join(", ")}  (reviews at exact due time)\n`);

const rows: (string | number)[][] = [];
for (let i = 0; i < grades.length; i++) {
  const q = grades[i];
  const raw = algo.calculateNextReview(state, q, now);
  // Mirrors the review route: modifiers are applied AFTER the strategy,
  // exactly as applyUserModifiers is composed in production.
  const { next } = applyUserModifiers(state, raw, q, prefs, now, () => 0.5);
  rows.push([
    i + 1,
    q,
    next.state,
    next.intervalDays.toFixed(2),
    next.easeFactor.toFixed(3),
    next.repetitions,
    next.box,
    next.lapses,
    next.dueAt.toISOString().slice(0, 10),
  ]);
  now = next.dueAt; // perfect-student assumption
  state = next;
  if (next.state === "MASTERED") {
    console.log("(card reached MASTERED — remaining grades ignored)\n");
    break;
  }
}

printTable(
  ["#", "grade", "state", "intervalDays", "EF", "reps", "box", "lapses", "dueAt"],
  rows
);
