import { LeitnerSystem } from "./leitner";
import { SM2Algorithm } from "./sm2";
import type { SRSAlgorithm, SRSAlgorithmType } from "./types";

import { FSRSAlgorithm } from "./fsrs";

// SM2/Leitner are stateless singletons. FSRS carries a per-user tuning knob
// (desiredRetention), so it is built per-request in getAlgorithm instead.
const registry: Record<Exclude<SRSAlgorithmType, "FSRS">, SRSAlgorithm> = {
  SM2: new SM2Algorithm(),
  LEITNER: new LeitnerSystem(),
};

export interface AlgorithmOptions {
  /** FSRS target retention (0–1). Ignored by SM2/Leitner. */
  desiredRetention?: number;
}

export function getAlgorithm(
  type: SRSAlgorithmType,
  opts?: AlgorithmOptions
): SRSAlgorithm {
  // FSRS is instantiated per call so the caller's desiredRetention actually
  // reaches the scheduler (a shared singleton would freeze it at the default).
  if (type === "FSRS") {
    return new FSRSAlgorithm(opts?.desiredRetention);
  }
  const algorithm = registry[type];
  if (!algorithm) {
    throw new Error(`Unknown SRS algorithm: ${type}`);
  }
  return algorithm;
}

export const SRS_ALGORITHMS: SRSAlgorithmType[] = ["SM2", "LEITNER", "FSRS"];

export { SM2Algorithm } from "./sm2";
export { LeitnerSystem, BOX_INTERVALS } from "./leitner";
export { FSRSAlgorithm } from "./fsrs";
export { applyUserModifiers, type UserSRSPrefs } from "./modifiers";
export * from "./types";
