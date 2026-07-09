import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { forgotPasswordSchema } from "@/lib/validation";

/** SHA-256 of a high-entropy random token — safe to look up directly (no timing-safe compare needed, unlike password hashes). */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const normalizedEmail = parsed.data.email.toLowerCase();

    // Rate limiting: 5 requests per 15 minutes per email.
    if (!rateLimit(`forgot-password:${normalizedEmail}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Check if user exists.
    // IMPORTANT: Even if the user doesn't exist, we return the same success
    // response to prevent email enumeration attacks.
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // Generate a secure random token; only its hash is ever persisted.
      const token = randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      // Token expires in 1 hour.
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      // Clear any previous outstanding tokens for this email, then save the new one.
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { email: normalizedEmail } }),
        prisma.passwordResetToken.create({
          data: {
            email: normalizedEmail,
            token: tokenHash,
            expires,
          },
        }),
      ]);

      // Send the raw (unhashed) token — this is the only place it exists in plaintext.
      await sendPasswordResetEmail(normalizedEmail, token);
    }

    return NextResponse.json(
      { message: "If an account with that email exists, we sent you a password reset link." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
