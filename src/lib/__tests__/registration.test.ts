import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  isGuestModeEnabled,
  isRegistrationOpen,
  isRegistrationOverride,
} from "@/lib/registration";

const ORIGINAL_SELF_HOSTED = process.env.SELF_HOSTED;
const ORIGINAL_ALLOW_REGISTRATION = process.env.ALLOW_REGISTRATION;

afterEach(() => {
  process.env.SELF_HOSTED = ORIGINAL_SELF_HOSTED;
  process.env.ALLOW_REGISTRATION = ORIGINAL_ALLOW_REGISTRATION;
  vi.clearAllMocks();
});

describe("isRegistrationOverride (case-insensitive)", () => {
  it("treats any casing/whitespace of 'true' as open", () => {
    for (const v of ["true", "True", "TRUE", "  true  "]) {
      process.env.ALLOW_REGISTRATION = v;
      expect(isRegistrationOverride(), `for ALLOW_REGISTRATION=${JSON.stringify(v)}`).toBe(true);
    }
  });

  it("fails closed on unset or any non-'true' value — unlike SELF_HOSTED, the unsafe state here needs an explicit opt-in", () => {
    for (const v of ["", "1", "yes", "false", " disabled "]) {
      process.env.ALLOW_REGISTRATION = v;
      expect(isRegistrationOverride(), `for ALLOW_REGISTRATION=${JSON.stringify(v)}`).toBe(false);
    }
    delete process.env.ALLOW_REGISTRATION;
    expect(isRegistrationOverride()).toBe(false);
  });
});

describe("isRegistrationOpen", () => {
  beforeEach(() => {
    delete process.env.ALLOW_REGISTRATION;
  });

  it("is always open when hosted (SELF_HOSTED=false), regardless of user count", async () => {
    process.env.SELF_HOSTED = "false";
    vi.mocked(prisma.user.count).mockResolvedValue(5);
    expect(await isRegistrationOpen()).toBe(true);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it("is open on self-hosted with zero users (first account claims the instance)", async () => {
    process.env.SELF_HOSTED = "true";
    vi.mocked(prisma.user.count).mockResolvedValue(0);
    expect(await isRegistrationOpen()).toBe(true);
  });

  it("is closed on self-hosted once an account exists", async () => {
    process.env.SELF_HOSTED = "true";
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    expect(await isRegistrationOpen()).toBe(false);
  });

  it("reopens on self-hosted with ALLOW_REGISTRATION=true, even with users present", async () => {
    process.env.SELF_HOSTED = "true";
    process.env.ALLOW_REGISTRATION = "true";
    vi.mocked(prisma.user.count).mockResolvedValue(3);
    expect(await isRegistrationOpen()).toBe(true);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });
});

describe("isGuestModeEnabled", () => {
  it("is enabled when hosted", () => {
    process.env.SELF_HOSTED = "false";
    delete process.env.ALLOW_REGISTRATION;
    expect(isGuestModeEnabled()).toBe(true);
  });

  it("is disabled on self-hosted by default", () => {
    process.env.SELF_HOSTED = "true";
    delete process.env.ALLOW_REGISTRATION;
    expect(isGuestModeEnabled()).toBe(false);
  });

  it("is re-enabled on self-hosted with ALLOW_REGISTRATION=true", () => {
    process.env.SELF_HOSTED = "true";
    process.env.ALLOW_REGISTRATION = "true";
    expect(isGuestModeEnabled()).toBe(true);
  });
});
