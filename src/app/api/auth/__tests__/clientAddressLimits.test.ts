/**
 * Auth routes key their per-source limits on the client address a trusted
 * proxy supplies (X-Forwarded-For, then X-Real-IP). Without either header
 * there must be no shared "unknown" bucket, only the global cap, or one
 * bucket would cap every visitor on the site together.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/registration", () => ({ isRegistrationOpen: async () => true }));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { rateLimit } from "@/lib/rateLimit";
import { clientAddress, clientAddressFrom } from "@/lib/clientAddress";
import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { POST as forgotPOST } from "@/app/api/auth/forgot-password/route";
import { POST as resetPOST } from "@/app/api/auth/reset-password/route";
import { GET as verifyGET } from "@/app/api/auth/verify/route";

type Route = (req: Request) => Promise<Response>;

const routes: Array<{ name: string; call: Route; perSource: string }> = [
  {
    name: "signup",
    call: (req) => signupPOST(req),
    perSource: "signup:",
  },
  {
    name: "forgot-password",
    call: (req) => forgotPOST(req),
    perSource: "forgot-password:ip:",
  },
  {
    name: "reset-password",
    call: (req) => resetPOST(req),
    perSource: "reset-password:",
  },
  {
    name: "verify",
    call: (req) => verifyGET(req),
    perSource: "verify:",
  },
];

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/auth/x", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ email: "learner@example.com" }),
  });
}

function verifyRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/auth/verify?token=x", { headers });
}

function keys() {
  return vi.mocked(rateLimit).mock.calls.map(([key]) => key);
}

beforeEach(() => {
  vi.mocked(rateLimit).mockReset();
  // Allow every bucket except the global one, so each route evaluates its
  // per-source check and then stops before touching the database.
  vi.mocked(rateLimit).mockImplementation((key: string) => !key.endsWith(":global"));
});

describe("clientAddress", () => {
  it("prefers the first X-Forwarded-For hop, then X-Real-IP, else empty", () => {
    expect(clientAddressFrom("203.0.113.7, 10.0.0.1", "198.51.100.4")).toBe("203.0.113.7");
    expect(clientAddressFrom(null, " 198.51.100.4 ")).toBe("198.51.100.4");
    expect(clientAddressFrom("", undefined)).toBe("");
    expect(clientAddress(new Request("http://localhost"))).toBe("");
  });
});

describe.each(routes)("$name per-source limit", ({ name, call, perSource }) => {
  const make = name === "verify" ? verifyRequest : request;

  it("keys on X-Forwarded-For when present", async () => {
    await call(make({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }));
    expect(keys()).toContain(`${perSource}203.0.113.7`);
  });

  it("falls back to X-Real-IP", async () => {
    await call(make({ "x-real-ip": "198.51.100.4" }));
    expect(keys()).toContain(`${perSource}198.51.100.4`);
  });

  it("skips the per-source bucket when no address is supplied", async () => {
    const res = await call(make());
    // Limited by the global cap: 429, or the verify page's error redirect.
    expect([429, 307]).toContain(res.status);
    expect(keys().some((k) => k.startsWith(perSource) && !k.endsWith(":global"))).toBe(false);
    expect(keys().some((k) => k.includes("unknown"))).toBe(false);
    expect(keys().some((k) => k.endsWith(":global"))).toBe(true);
  });
});
