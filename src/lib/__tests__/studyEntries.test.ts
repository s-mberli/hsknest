import { describe, expect, it } from "vitest";

import { getPracticeAvailability } from "@/lib/practiceModes";
import { getSupplementaryStudyEntries } from "@/lib/studyEntries";

const zhFull = getPracticeAvailability({ languageCode: "zh", hasSentences: true });
const deMinimal = getPracticeAvailability({ languageCode: "de", hasSentences: false });

describe("getSupplementaryStudyEntries", () => {
  it("offers nothing to a learner with no learned words", () => {
    expect(
      getSupplementaryStudyEntries({ learnedCount: 0, availability: zhFull })
    ).toEqual([]);
  });

  it("offers exactly Practice then Word Ninja once a word is learned", () => {
    const entries = getSupplementaryStudyEntries({
      learnedCount: 1,
      availability: zhFull,
    });
    expect(entries.map((e) => e.key)).toEqual(["practice", "ninja"]);
  });

  it("collapses to the same two entries however many modes are rotatable", () => {
    // Four rotatable modes and two rotatable modes must both read as one
    // Practice entry — the consolidation is the whole point of the ticket.
    expect(zhFull.rotatable).toHaveLength(4);
    expect(deMinimal.rotatable).toHaveLength(2);

    const many = getSupplementaryStudyEntries({ learnedCount: 5, availability: zhFull });
    const few = getSupplementaryStudyEntries({ learnedCount: 5, availability: deMinimal });
    expect(many.map((e) => e.key)).toEqual(few.map((e) => e.key));
  });

  it("sends Practice to the rotation route with practice semantics", () => {
    const [practice] = getSupplementaryStudyEntries({
      learnedCount: 5,
      availability: zhFull,
    });
    expect(practice.href).toContain("/study/practice");
    // Without mode=practice the route redirects, and a Sentences round would
    // post a real Review.
    expect(practice.href).toContain("mode=practice");
  });

  it("keeps the fast-paced warning on the Word Ninja entry", () => {
    const ninja = getSupplementaryStudyEntries({
      learnedCount: 5,
      availability: zhFull,
    }).find((e) => e.key === "ninja");
    expect(ninja?.subtitle).toBe("Fast-paced, motion-heavy");
    expect(ninja?.href).toContain("/study/ninja");
  });

  it("omits Practice when no mode is rotatable, keeping Ninja reachable", () => {
    const entries = getSupplementaryStudyEntries({
      learnedCount: 5,
      availability: { rotatable: [], ninja: true },
    });
    expect(entries.map((e) => e.key)).toEqual(["ninja"]);
  });

  it("omits Word Ninja when it is unavailable", () => {
    const entries = getSupplementaryStudyEntries({
      learnedCount: 5,
      availability: { rotatable: ["quiz", "match"], ninja: false },
    });
    expect(entries.map((e) => e.key)).toEqual(["practice"]);
  });
});
