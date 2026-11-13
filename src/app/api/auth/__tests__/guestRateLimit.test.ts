/**
 * The guest route keys its per-source limit on the client address a trusted
 * proxy supplies. Without that header there must be no shared "unknown"
 * bucket, or one bucket would cap every visitor on the site together.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/registration", () => ({ isGuestModeEnabled: () => true }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn(() => false) }));

import { rateLimit } from "@/lib/rateLimit";
import { POST } from "@/app/api/auth/guest/route";

function guestRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/auth/guest", { method: "POST", headers });
}

beforeEach(() => {
  vi.mocked(rateLimit).mockReset();
  // Refuse on the first check so the route stops before touching the database.
  vi.mocked(rateLimit).mockReturnValue(false);
});

describe("POST /api/auth/guest rate limiting", () => {
  it("limits per source when the proxy supplies the client address", async () => {
    const res = await POST(guestRequest({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }));
    expect(res.status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith("guest:203.0.113.7", 30, 60 * 60 * 1000);
  });

  it("falls back to x-real-ip", async () => {
    await POST(guestRequest({ "x-real-ip": "198.51.100.4" }));
    expect(rateLimit).toHaveBeenCalledWith("guest:198.51.100.4", 30, 60 * 60 * 1000);
  });

  it("uses only the global cap when no client address is supplied", async () => {
    const res = await POST(guestRequest());
    expect(res.status).toBe(429);
    const keys = vi.mocked(rateLimit).mock.calls.map(([key]) => key);
    expect(keys).toEqual(["guest:global"]);
  });
});
