import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.EMAIL_FROM || "noreply@recall-app.com";

let warnedNoEmail = false;
function warnNoEmailOnce() {
  if (warnedNoEmail) return;
  warnedNoEmail = true;
  console.warn(
    "[email] RESEND_API_KEY is not set — emails will be logged to the console instead of sent. Set RESEND_API_KEY to enable real delivery."
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  // Use a placeholder base URL if NEXT_PUBLIC_APP_URL is not set
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  if (!resend) {
    warnNoEmailOnce();
    console.log(`[email] Password reset link for ${email}: ${resetLink}`);
    return { success: true, data: null };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Reset your Recall password",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset Your Password</h2>
          <p>We received a request to reset your password for your Recall account.</p>
          <p>Click the button below to reset it:</p>
          <div style="margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p style="color: #666; font-size: 14px; margin-top: 40px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetLink}">${resetLink}</a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending password reset email:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return { success: false, error };
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyLink = `${baseUrl}/api/auth/verify?token=${token}`;

  if (!resend) {
    warnNoEmailOnce();
    console.log(`[email] Verification link for ${email}: ${verifyLink}`);
    return { success: true, data: null };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Verify your email for Recall",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Recall!</h2>
          <p>Please verify your email address by clicking the button below:</p>
          <div style="margin: 30px 0;">
            <a href="${verifyLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Verify Email
            </a>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 40px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${verifyLink}">${verifyLink}</a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Error sending verification email:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return { success: false, error };
  }
}
