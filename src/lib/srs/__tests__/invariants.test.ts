import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getAlgorithm } from "@/lib/srs";
import type { SRSAlgorithmType, SRSState, ReviewQuality } from "@/lib/srs/types";
import { addDays } from "@/lib/srs/types";

const NOW = new Date("2025-08-29");
const ALGORITHMS: SRSAlgorithmType[] = ["SM2", "LEITNER", "FSRS"];

/**
 * Property-based tests for SRS algorithm invariants.
 *
 * These tests find edge cases and off-by-one errors that example-based tests
 * tend to miss. They verify fundamental properties that must hold across all
 * algorithm implementations.
 */

describe("SRS algorithm invariants (property-based)", () => {
  // Arbitrary for generating valid review states
  const arbSRSState = (): fc.Arbitrary<SRSState> =>
    fc
      .tuple(
        fc.nat(100),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 10 })
      )
      .map(([rep, interval, box, lapses, ef]) => ({
        state: "REVIEW" as const,
        easeFactor: 1.3 + ef * 0.1,
        intervalDays: interval,
        repetitions: rep,
        box,
        lapses,
        dueAt: addDays(NOW, interval),
        lastReviewedAt: NOW,
      }));

  const arbQuality = (): fc.Arbitrary<ReviewQuality> =>
    fc.integer({ min: 0, max: 5 }) as fc.Arbitrary<ReviewQuality>;

  it("invariant: intervalDays is always >= 1 after calculateNextReview", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SRSAlgorithmType>(...ALGORITHMS),
        arbSRSState(),
        arbQuality(),
        (algo, state, quality) => {
          const algorithm = getAlgorithm(algo);
          const result = algorithm.calculateNextReview(state, quality, NOW);
          expect(result.next.intervalDays).toBeGreaterThanOrEqual(1);
        }
      )
    );
  });

  it("invariant: dueAt is always > now after calculateNextReview", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SRSAlgorithmType>(...ALGORITHMS),
        arbSRSState(),
        arbQuality(),
        (algo, state, quality) => {
          const algorithm = getAlgorithm(algo);
          const result = algorithm.calculateNextReview(state, quality, NOW);
          expect(result.next.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
        }
      )
    );
  });

  it("invariant: dueAt matches NOW + intervalDays", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SRSAlgorithmType>(...ALGORITHMS),
        arbSRSState(),
        arbQuality(),
        (algo, state, quality) => {
          const algorithm = getAlgorithm(algo);
          const result = algorithm.calculateNextReview(state, quality, NOW);
          const { intervalDays, dueAt } = result.next;
          const expectedDue = addDays(NOW, intervalDays);
          expect(dueAt.getTime()).toBe(expectedDue.getTime());
        }
      )
    );
  });

  it("invariant: SM-2 easeFactor never drops below 1.3", () => {
    const sm2 = getAlgorithm("SM2");
    fc.assert(
      fc.property(
        fc.array(arbQuality(), { minLength: 1, maxLength: 20 }),
        (qualities) => {
          let state = sm2.initialState(NOW);
          let now = new Date(NOW);

          qualities.forEach((quality) => {
            const res = sm2.calculateNextReview(state, quality, now);
            state = res.next;
            now = new Date(state.dueAt);
            expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
          });
        }
      )
    );
  });

  it("invariant: calculateNextReview never mutates input state", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SRSAlgorithmType>(...ALGORITHMS),
        arbSRSState(),
        arbQuality(),
        (algo, state, quality) => {
          const algorithm = getAlgorithm(algo);
          const inputSnapshot = JSON.stringify(state);

          algorithm.calculateNextReview(state, quality, NOW);

          expect(JSON.stringify(state)).toBe(inputSnapshot);
        }
      )
    );
  });

  it("invariant: algorithm switch preserves dueAt > now", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SRSAlgorithmType>(...ALGORITHMS),
        fc.constantFrom<SRSAlgorithmType>(...ALGORITHMS),
        arbSRSState(),
        arbQuality(),
        (sourceAlgo, destAlgo, state, quality) => {
          // Build some history on the source algorithm
          const source = getAlgorithm(sourceAlgo);
          const sourceState = source.calculateNextReview(state, quality, NOW).next;

          // Switch to destination and run one review
          const dest = getAlgorithm(destAlgo);
          const destState = dest.calculateNextReview(sourceState, quality, NOW)
            .next;

          // dueAt should still be in the future
          expect(destState.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
        }
      )
    );
  });
});
