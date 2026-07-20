import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST as forgotPasswordPOST } from "../forgot-password/route";
import { POST as resetPasswordPOST } from "../reset-password/route";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((operations) => Promise.all(operations)),
  }
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => true),
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn(async () => "hashed_password"),
}));

function createRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Auth Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/auth/forgot-password", () => {
    it("returns 400 if email is missing", async () => {
      const req = createRequest({});
      const res = await forgotPasswordPOST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect((data as Record<string, unknown>).error).toBe("Invalid input");
    });

    it("returns 429 if rate limit is exceeded", async () => {
      vi.mocked(rateLimit).mockReturnValueOnce(false);
      const req = createRequest({ email: "test@example.com" });
      const res = await forgotPasswordPOST(req);
      expect(res.status).toBe(429);
    });

    it("returns 200 and does not send email if user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      
      const req = createRequest({ email: "test@example.com" });
      const res = await forgotPasswordPOST(req);
      
      expect(res.status).toBe(200);
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("returns 200 and sends email if user exists", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "1", email: "test@example.com" } as any);
      
      const req = createRequest({ email: "test@example.com" });
      const res = await forgotPasswordPOST(req);
      
      expect(res.status).toBe(200);
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(sendPasswordResetEmail).toHaveBeenCalledWith("test@example.com", expect.any(String));

      // Security: the raw (emailed) token must never be the one persisted.
      const createArgs = vi.mocked(prisma.passwordResetToken.create).mock.calls[0][0] as {
        data: { token: string };
      };
      const emailedToken = vi.mocked(sendPasswordResetEmail).mock.calls[0][1];
      expect(createArgs.data.token).not.toBe(emailedToken);
      expect(createArgs.data.token).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("returns 400 if token or password is missing", async () => {
      const req = createRequest({ token: "123" }); // missing password
      const res = await resetPasswordPOST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 if password is too short", async () => {
      const req = createRequest({ token: "123", password: "short" });
      const res = await resetPasswordPOST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 if token is invalid", async () => {
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValueOnce(null);
      const req = createRequest({ token: "invalid_token", password: "validpassword123" });
      const res = await resetPasswordPOST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 if token has expired", async () => {
      const expiredDate = new Date(Date.now() - 10000); // Past date
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValueOnce({
        id: "1", token: "valid", email: "test@example.com", expires: expiredDate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      
      const req = createRequest({ token: "valid", password: "validpassword123" });
      const res = await resetPasswordPOST(req);
      
      expect(res.status).toBe(400);
      expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: "1" } });
    });

    it("returns 200 and updates password if valid", async () => {
      const validDate = new Date(Date.now() + 10000); // Future date
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValueOnce({
        id: "1", token: "valid", email: "test@example.com", expires: validDate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      
      const req = createRequest({ token: "valid", password: "validpassword123" });
      const res = await resetPasswordPOST(req);
      
      expect(res.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
