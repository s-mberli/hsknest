/**
 * Route-level coverage for the self-hosted registration gate: proves the
 * signup and guest routes actually call isRegistrationOpen/isGuestModeEnabled
 * rather than just having a unit-tested helper that nothing calls.
 * See src/lib/registration.ts and src/lib/__tests__/registration.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    verificationToken: {
      create: vi.fn(),
    },
  },
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => true),
}));
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
}));
vi.mock("bcryptjs", () => ({
  hash: vi.fn(async () => "hashed_password"),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
  })),
}));

import { prisma } from "@/lib/prisma";
import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { POST as guestPOST } from "@/app/api/auth/guest/route";

const ORIGINAL_SELF_HOSTED = process.env.SELF_HOSTED;
const ORIGINAL_ALLOW_REGISTRATION = process.env.ALLOW_REGISTRATION;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ALLOW_REGISTRATION;
});

afterEach(() => {
  process.env.SELF_HOSTED = ORIGINAL_SELF_HOSTED;
  process.env.ALLOW_REGISTRATION = ORIGINAL_ALLOW_REGISTRATION;
});

function signupRequest() {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "new@example.com", password: "password123" }),
  });
}

describe("POST /api/auth/signup — self-hosted registration gate", () => {
  it("succeeds on an empty self-hosted instance (first account claims it)", async () => {
    process.env.SELF_HOSTED = "true";
    vi.mocked(prisma.user.count).mockResolvedValue(0);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "u1" } as never);

    const res = await signupPOST(signupRequest());
    expect(res.status).toBe(201);
  });

  it("returns 403 once a self-hosted instance already has an account", async () => {
    process.env.SELF_HOSTED = "true";
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    const res = await signupPOST(signupRequest());
    expect(res.status).toBe(403);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("reopens with ALLOW_REGISTRATION=true even with an account present", async () => {
    process.env.SELF_HOSTED = "true";
    process.env.ALLOW_REGISTRATION = "true";
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "u2" } as never);

    const res = await signupPOST(signupRequest());
    expect(res.status).toBe(201);
  });

  it("stays open regardless of user count when hosted", async () => {
    process.env.SELF_HOSTED = "false";
    vi.mocked(prisma.user.count).mockResolvedValue(42);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "u3" } as never);

    const res = await signupPOST(signupRequest());
    expect(res.status).toBe(201);
  });
});

describe("POST /api/auth/guest — self-hosted guest gate", () => {
  it("404s by default on self-hosted", async () => {
    process.env.SELF_HOSTED = "true";
    const res = await guestPOST(new Request("http://localhost/api/auth/guest", { method: "POST" }));
    expect(res.status).toBe(404);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("reopens with ALLOW_REGISTRATION=true on self-hosted", async () => {
    process.env.SELF_HOSTED = "true";
    process.env.ALLOW_REGISTRATION = "true";
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "g1" } as never);

    const res = await guestPOST(new Request("http://localhost/api/auth/guest", { method: "POST" }));
    expect(res.status).toBe(201);
  });

  it("stays enabled when hosted", async () => {
    process.env.SELF_HOSTED = "false";
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "g2" } as never);

    const res = await guestPOST(new Request("http://localhost/api/auth/guest", { method: "POST" }));
    expect(res.status).toBe(201);
  });
});
