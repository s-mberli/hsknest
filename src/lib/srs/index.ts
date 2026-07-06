import { LeitnerSystem } from "./leitner";
import { SM2Algorithm } from "./sm2";
import type { SRSAlgorithm, SRSAlgorithmType } from "./types";

const registry: Record<SRSAlgorithmType, SRSAlgorithm> = {
  SM2: new SM2Algorithm(),
  LEITNER: new LeitnerSystem(),
};

export function getAlgorithm(type: SRSAlgorithmType): SRSAlgorithm {
  const algorithm = registry[type];
  if (!algorithm) {
    throw new Error(`Unknown SRS algorithm: ${type}`);
  }
  return algorithm;
}

export const SRS_ALGORITHMS: SRSAlgorithmType[] = ["SM2", "LEITNER"];

export { SM2Algorithm } from "./sm2";
export { LeitnerSystem, BOX_INTERVALS } from "./leitner";
export { applyUserModifiers, type UserSRSPrefs } from "./modifiers";
export * from "./types";
