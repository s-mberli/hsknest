import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CredentialsConfig } from "next-auth/providers/credentials";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { _resetRateLimits } from "@/lib/rateLimit";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => ({
        id: where.email,
        email: where.email,
        passwordHash: "hash",
        name: null,
      })),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  compare: vi.fn(async () => true),
}));

const credentials = authOptions.providers[0] as CredentialsConfig & {
  options: Pick<CredentialsConfig, "authorize">;
};
const authorize = credentials.options.authorize;

function request(headers: Record<string, string> = {}) {
  return {
    headers,
    body: {},
    query: {},
    method: "POST",
  } as Parameters<typeof authorize>[1];
}

function login(email: string, sourceHeader?: [string, string]) {
  return authorize(
    { email, password: "correct horse battery staple" },
    request(sourceHeader ? { [sourceHeader[0]]: sourceHeader[1] } : {})
  );
}

describe("credentials login rate limits", () => {
  beforeEach(() => {
    _resetRateLimits();
    vi.clearAllMocks();
  });

  it("allows valid credentials when no source address header is available", async () => {
    const result = await login("learner@example.com");
    expect(result).toMatchObject({
      id: "learner@example.com",
      email: "learner@example.com",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("caps one source across email rotation while allowing another source", async () => {
    for (let i = 0; i < 60; i += 1) {
      const email = i % 2 === 0 ? "first@example.com" : "second@example.com";
      expect(await login(email, ["x-forwarded-for", "198.51.100.10"])).not.toBeNull();
    }

    expect(await login("rotated@example.com", ["x-real-ip", "198.51.100.10"])).toBeNull();
    expect(await login("fresh@example.com", ["x-forwarded-for", "198.51.100.11"])).not.toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(61);
  });

  it("keeps the per-account cap across different source addresses", async () => {
    for (let i = 0; i < 30; i += 1) {
      const source = i % 2 === 0 ? "198.51.100.20" : "198.51.100.21";
      expect(await login("target@example.com", ["x-forwarded-for", source])).not.toBeNull();
    }

    expect(await login("target@example.com", ["x-forwarded-for", "198.51.100.22"])).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(30);
  });

  it("keeps the process-wide cap after source and account limits", async () => {
    for (let i = 0; i < 1000; i += 1) {
      expect(await login(
        `learner-${i % 34}@example.com`,
        ["x-forwarded-for", `198.51.100.${i % 17 + 1}`]
      )).not.toBeNull();
    }

    expect(await login("last@example.com", ["x-forwarded-for", "198.51.100.18"])).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1000);
  });
});
