import { BOX_INTERVALS } from "./leitner";
import type { SRSAlgorithmType, SRSState } from "./types";

/**
 * Recover an algorithm's missing progress marker from the shared interval
 * when switching into SM-2 or Leitner. The algorithm marker lets us rebuild
 * stale fields from the shared interval after repeated switches. Legacy rows
 * without a marker use the conservative default-only inference. Learning rows
 * only reset the destination algorithm's canonical lapse counter; their lapse
 * interval is never used for progress inference.
 */
export function hydrateStateForAlgorithm(
  state: SRSState,
  algorithm: SRSAlgorithmType
): SRSState {
  const storedAlgorithm = state.srsData?.algorithm;
  const hasAlgorithmMarker =
    storedAlgorithm === "SM2" ||
    storedAlgorithm === "LEITNER" ||
    storedAlgorithm === "FSRS";
  const switchedFromAnotherAlgorithm =
    hasAlgorithmMarker && storedAlgorithm !== algorithm;

  if (state.state === "NEW") return state;

  // FSRS's stability/difficulty are specific to its own review history. If a
  // marked foreign scheduler advanced the shared interval, make FSRS hydrate
  // from that interval instead of reusing an older FSRS payload.
  if (
    algorithm === "FSRS" &&
    switchedFromAnotherAlgorithm &&
    state.srsData?.fsrs !== undefined
  ) {
    const otherData = { ...state.srsData };
    delete otherData.fsrs;
    return {
      ...state,
      srsData: Object.keys(otherData).length > 0 ? otherData : undefined,
    };
  }

  if (state.state === "LEARNING") {
    // A lapse under SM-2 resets repetitions, while a lapse under Leitner
    // resets the box. Stale values from a previously used algorithm must not
    // restore the card's mature schedule when the learner switches back.
    if (algorithm === "SM2" && state.repetitions !== 0) {
      return { ...state, repetitions: 0 };
    }
    if (algorithm === "LEITNER" && state.box !== 1) {
      return { ...state, box: 1 };
    }
    return state;
  }

  const isReviewState = state.state === "REVIEW" || state.state === "MASTERED";
  if (!isReviewState) return state;

  const hasMatureSchedule = state.intervalDays > 1;

  if (
    algorithm === "SM2" &&
    (switchedFromAnotherAlgorithm ||
      (!hasAlgorithmMarker && hasMatureSchedule && state.repetitions === 0) ||
      (state.state === "MASTERED" &&
        hasMatureSchedule &&
        state.repetitions <= 1))
  ) {
    // A short foreign schedule maps to SM-2's first successful step; a mature
    // interval continues on its multiplier path instead of restarting at day 1.
    return { ...state, repetitions: hasMatureSchedule ? 2 : 1 };
  }

  if (
    algorithm === "LEITNER" &&
    (switchedFromAnotherAlgorithm ||
      (!hasAlgorithmMarker && hasMatureSchedule && state.box === 1) ||
      (state.state === "MASTERED" && hasMatureSchedule && state.box === 1))
  ) {
    // Short foreign intervals map to box 1. Leitner tops out at 16 days; for
    // intermediate intervals, use the greatest box not exceeding that value.
    let box = 1;
    for (let index = 0; index < BOX_INTERVALS.length; index += 1) {
      if (state.intervalDays >= BOX_INTERVALS[index]) box = index + 1;
    }
    return { ...state, box };
  }

  return state;
}
