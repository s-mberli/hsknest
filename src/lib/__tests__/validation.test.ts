import { describe, expect, it } from "vitest";

import {
  feedbackSchema,
  importSchema,
  signupSchema,
  wordInputSchema,
} from "@/lib/validation";

describe("feedbackSchema", () => {
  it("accepts a valid bug report", () => {
    const r = feedbackSchema.safeParse({
      category: "bug",
      message: "The study deck freezes after ten cards.",
      page: "/study",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown category", () => {
    const r = feedbackSchema.safeParse({
      category: "complaint",
      message: "This is long enough to pass the length check.",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a message shorter than 10 characters", () => {
    const r = feedbackSchema.safeParse({ category: "idea", message: "too short" });
    expect(r.success).toBe(false);
  });

  it("rejects a message longer than 2000 characters", () => {
    const r = feedbackSchema.safeParse({
      category: "other",
      message: "x".repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  it("allows page to be omitted", () => {
    const r = feedbackSchema.safeParse({
      category: "idea",
      message: "A dark-mode toggle on the login page would be nice.",
    });
    expect(r.success).toBe(true);
  });
});

describe("input caps", () => {
  it("rejects import text over the ~100KB cap", () => {
    const r = importSchema.safeParse({ text: "a".repeat(100_001) });
    expect(r.success).toBe(false);
  });

  it("accepts import text at the cap", () => {
    const r = importSchema.safeParse({ text: "a".repeat(100_000) });
    expect(r.success).toBe(true);
  });

  it("rejects a signup password over 200 characters", () => {
    const r = signupSchema.safeParse({
      email: "user@example.com",
      password: "p".repeat(201),
    });
    expect(r.success).toBe(false);
  });

  it("rejects a word translation over 500 characters", () => {
    const r = wordInputSchema.safeParse({
      term: "term",
      translation: "t".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});
