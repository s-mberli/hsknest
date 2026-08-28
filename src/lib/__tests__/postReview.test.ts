import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postReview, type PostReviewOptions } from "@/lib/postReview";
import { toast } from "sonner";

// Mock the sonner toast module to prevent actual toast calls during tests
vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

describe("postReview", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("successful requests", () => {
    it("calls onSuccess when the request succeeds", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });
      const onSuccess = vi.fn();

      await postReview("w123", 4, { onSuccess });

      expect(onSuccess).toHaveBeenCalledOnce();
    });

    it.each([
      { opts: {}, description: "base request with wordId and quality" },
      {
        opts: { practice: true },
        description: "includes practice flag when practice mode is set",
      },
      {
        opts: { source: "quiz" as const },
        description: "includes source when provided",
      },
      {
        opts: { latencyMs: 2500 },
        description: "includes latencyMs when provided",
      },
    ])(
      "$description",
      async ({ opts }) => {
        fetchMock.mockResolvedValueOnce({ ok: true });

        await postReview("w123", 4, opts);

        const callArgs = fetchMock.mock.calls[0];
        expect(callArgs[0]).toBe("/api/study/review");
        expect(callArgs[1]?.method).toBe("POST");

        const body = JSON.parse(callArgs[1]!.body as string);
        expect(body.wordId).toBe("w123");
        expect(body.quality).toBe(4);

        // Verify optional fields are included when provided
        if (opts.practice) {
          expect(body.practice).toBe(true);
        } else {
          expect(body.practice).toBeUndefined();
        }
        if (opts.source) {
          expect(body.source).toBe(opts.source);
        } else {
          expect(body.source).toBeUndefined();
        }
        if (opts.latencyMs) {
          expect(body.latencyMs).toBe(opts.latencyMs);
        } else {
          expect(body.latencyMs).toBeUndefined();
        }
      }
    );

    it("includes multiple options together", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });

      await postReview("w123", 3, {
        practice: true,
        source: "match",
        latencyMs: 1800,
      });

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string
      );
      expect(body).toEqual({
        wordId: "w123",
        quality: 3,
        practice: true,
        source: "match",
        latencyMs: 1800,
      });
    });

    it("supports boolean shorthand for practice mode", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });

      await postReview("w123", 4, true);

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string
      );
      expect(body.practice).toBe(true);
    });
  });

  describe("404 stale card — silent drop", () => {
    it("returns silently on 404 (stale card)", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
      const onSuccess = vi.fn();
      const onRequeue = vi.fn();

      await postReview("w123", 4, { onSuccess, onRequeue });

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onRequeue).not.toHaveBeenCalled();
    });

    it("returns silently on 404 even after retry", async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      const onRequeue = vi.fn();
      await postReview("w123", 4, { onRequeue });

      expect(onRequeue).not.toHaveBeenCalled();
    });
  });

  describe("non-retriable 4xx errors (except 429)", () => {
    it("shows error toast and returns on 400", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid quality" }),
      });
      const onRequeue = vi.fn();

      await postReview("w123", 999, { onRequeue });

      expect(fetchMock).toHaveBeenCalledOnce(); // No retry
      expect(onRequeue).not.toHaveBeenCalled();
    });

    it("shows error toast with error message from response", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Validation error" }),
      });

      await postReview("w123", 4);

      // Assert the correct error message was shown
      expect(toast.error).toHaveBeenCalledWith("Review failed: Validation error");
      // Verify fetch was not retried
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("shows fallback error message when json() fails", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => {
          throw new Error("Cannot parse");
        },
      });

      await postReview("w123", 4);

      // Assert the fallback error message was shown
      expect(toast.error).toHaveBeenCalledWith("Review failed: Invalid input");
      // Verify fetch was not retried
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  describe("retriable errors — 429, 5xx, network", () => {
    it("retries on 429 (rate limited)", async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: true });
      const onSuccess = vi.fn();

      await postReview("w123", 4, { onSuccess });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(onSuccess).toHaveBeenCalled();
    });

    it("retries on 5xx server error", async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true });
      const onSuccess = vi.fn();

      await postReview("w123", 4, { onSuccess });

      // After retry succeeds, onSuccess should be called
      expect(onSuccess).toHaveBeenCalled();
    });

    it("retries on network error", async () => {
      fetchMock
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ ok: true });
      const onSuccess = vi.fn();

      await postReview("w123", 4, { onSuccess });

      // After retry succeeds following network error, onSuccess should be called
      expect(onSuccess).toHaveBeenCalled();
    });

    it("calls onRequeue if retry also fails (retriable)", async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 503 });
      const onRequeue = vi.fn();

      await postReview("w123", 4, { onRequeue });

      // After both retries fail, onRequeue should be called
      expect(onRequeue).toHaveBeenCalled();
    });

    it("calls onRequeue if network error persists on retry", async () => {
      fetchMock
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"));
      const onRequeue = vi.fn();

      await postReview("w123", 4, { onRequeue });

      // After both retries fail with network error, onRequeue should be called
      expect(onRequeue).toHaveBeenCalled();
    });
  });

  describe("mixed retriable scenarios", () => {
    it("retries on 404 retry after 5xx initial (404 wins, silently drops)", async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 404 });
      const onRequeue = vi.fn();

      await postReview("w123", 4, { onRequeue });

      // 404 on retry means silently drop, don't call onRequeue
      expect(onRequeue).not.toHaveBeenCalled();
    });
  });

  describe("options object compatibility", () => {
    it("accepts PostReviewOptions with all fields", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });
      const options: PostReviewOptions = {
        practice: true,
        source: "ninja",
        latencyMs: 3000,
        onSuccess: vi.fn(),
        onRequeue: vi.fn(),
      };

      await postReview("w123", 5, options);

      expect(options.onSuccess).toHaveBeenCalled();
    });

    it("handles missing optional fields in PostReviewOptions", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });
      const options: PostReviewOptions = {
        source: "sentences",
      };

      await postReview("w123", 3, options);

      const body = JSON.parse(
        fetchMock.mock.calls[0][1]!.body as string
      );
      expect(body.wordId).toBe("w123");
      expect(body.quality).toBe(3);
      expect(body.source).toBe("sentences");
      expect(body.practice).toBeUndefined();
      expect(body.latencyMs).toBeUndefined();
    });
  });
});
