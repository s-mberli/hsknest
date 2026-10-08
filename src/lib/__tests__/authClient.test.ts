import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, signIn } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ getSession, signIn }));

import { signInWithCredentials } from "@/lib/authClient";

describe("signInWithCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a successful sign-in with a confirmed user session", async () => {
    signIn.mockResolvedValue({ ok: true, url: "/dashboard" });
    getSession.mockResolvedValue({ user: { id: "user-1" } });

    await expect(signInWithCredentials("a@example.test", "password")).resolves.toEqual({ ok: true });
    expect(signIn).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it("retries once when NextAuth returns its explicit CSRF sign-in URL", async () => {
    signIn
      .mockResolvedValueOnce({ url: "/api/auth/signin?csrf=true" })
      .mockResolvedValueOnce({ ok: true, url: "/dashboard" });
    getSession.mockResolvedValue({ user: { id: "user-1" } });

    await expect(signInWithCredentials("a@example.test", "password")).resolves.toEqual({ ok: true });
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(getSession).toHaveBeenCalledOnce();
  });

  it("does not retry a successful callback URL that happens to contain csrf=true", async () => {
    signIn.mockResolvedValue({ ok: true, url: "/login?csrf=true" });
    getSession.mockResolvedValue({ user: { id: "user-1" } });

    await expect(signInWithCredentials("a@example.test", "password")).resolves.toEqual({ ok: true });
    expect(signIn).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it("fails after a second explicit CSRF response", async () => {
    signIn.mockResolvedValue({ url: "/api/auth/signin?csrf=true" });

    await expect(signInWithCredentials("a@example.test", "password")).resolves.toEqual({
      ok: false,
      reason: "session",
    });
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("does not retry invalid credentials", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin" });

    await expect(signInWithCredentials("a@example.test", "password")).resolves.toEqual({
      ok: false,
      reason: "credentials",
    });
    expect(signIn).toHaveBeenCalledOnce();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("fails without navigating when the session has no user id", async () => {
    signIn.mockResolvedValue({ ok: true, url: "/dashboard" });
    getSession.mockResolvedValue({ user: {} });

    await expect(signInWithCredentials("a@example.test", "password")).resolves.toEqual({
      ok: false,
      reason: "session",
    });
    expect(signIn).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it("converts network failures into a result", async () => {
    signIn.mockRejectedValue(new Error("network failure"));

    await expect(signInWithCredentials("a@example.test", "password")).resolves.toEqual({
      ok: false,
      reason: "network",
    });
    expect(signIn).toHaveBeenCalledOnce();
    expect(getSession).not.toHaveBeenCalled();
  });
});
