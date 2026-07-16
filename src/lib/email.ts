import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.EMAIL_FROM || "noreply@hsknest.com";

let warnedNoEmail = false;
function warnNoEmailOnce() {
  if (warnedNoEmail) return;
  warnedNoEmail = true;
  console.warn(
    "[email] RESEND_API_KEY is not set — emails will be logged to the console instead of sent. Set RESEND_API_KEY to enable real delivery."
  );
}

/**
 * Console fallback is a dev/self-host convenience. On the managed hosted
 * instance (SELF_HOSTED=false) stdout is an aggregated log stream, so live
 * reset/verification links must never be printed there — a missing key is
 * an ops misconfiguration, reported loudly without the secret.
 */
function consoleFallbackAllowed(kind: string): boolean {
  // Same predicate as isSelfHosted() in subscription.ts, inlined so this
  // module stays importable from standalone scripts (no next/server).
  if (process.env.SELF_HOSTED !== "false") return true;
  console.error(
    `[email] MISCONFIGURATION: RESEND_API_KEY is unset on the hosted instance — ${kind} email NOT sent and its link NOT logged. Set RESEND_API_KEY.`
  );
  return false;
}

export async function sendPasswordResetEmail(email: string, token: string) {
  // Use a placeholder base URL if NEXT_PUBLIC_APP_URL is not set
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  if (!resend) {
    warnNoEmailOnce();
    if (!consoleFallbackAllowed("password reset")) {
      return { success: false, error: new Error("email not configured") };
    }
    console.log(`[email] Password reset link for ${email}: ${resetLink}`);
    return { success: true, data: null };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Reset your HSK Nest password",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset Your Password</h2>
          <p>We received a request to reset your password for your HSK Nest account.</p>
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

export type TrialEmailKind = "trial_welcome" | "trial_ending" | "trial_ended";

/**
 * Trial-lifecycle emails (hosted instance only). Deliberately functional
 * copy — these are service/transactional messages tied to the account, not
 * marketing — with sender identification and an account link in the footer.
 */
export async function sendTrialEmail(
  email: string,
  kind: TrialEmailKind,
  daysLeft?: number
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const content: Record<TrialEmailKind, { subject: string; body: string }> = {
    trial_welcome: {
      subject: "Welcome to HSK Nest — here's how to make it stick",
      body: `
        <h2>Welcome to HSK Nest!</h2>
        <p>Your 14-day free trial is running — no card on file, so it simply pauses if you do nothing.</p>
        <p>The one habit that matters: <strong>review a few minutes every day</strong>. The schedule does the rest — it brings each word back right before you'd forget it.</p>
        <p><a href="${baseUrl}/dashboard" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Study today's cards</a></p>`,
    },
    trial_ending: {
      subject: `Your HSK Nest trial ends in ${daysLeft ?? 3} days`,
      body: `
        <h2>${daysLeft ?? 3} days left in your trial</h2>
        <p>After that, studying pauses — but nothing is deleted. Your decks, progress, and CSV export stay available.</p>
        <p>To keep studying without a break, you can upgrade for €5/month (cancel anytime, 14-day refund).</p>
        <p><a href="${baseUrl}/settings#billing" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Manage your plan</a></p>`,
    },
    trial_ended: {
      subject: "Your HSK Nest trial has ended — your progress hasn't",
      body: `
        <h2>Your trial has ended</h2>
        <p>Everything you studied is saved. You can export your full progress as CSV anytime, upgrade for €5/month to continue, or self-host the open-source version for free.</p>
        <p><a href="${baseUrl}/settings#billing" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">See your options</a></p>`,
    },
  };

  const { subject, body } = content[kind];
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      ${body}
      <p style="color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 16px;">
        You're receiving this service email because you have an HSK Nest account.
        Manage or delete your account anytime in
        <a href="${baseUrl}/settings">Settings</a> — deleting it stops all email immediately.
      </p>
    </div>`;

  if (!resend) {
    warnNoEmailOnce();
    console.log(`[email] ${kind} for ${email}: ${subject}`);
    return { success: true, data: null };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html,
    });
    if (error) {
      console.error(`Error sending ${kind} email:`, error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (error) {
    console.error(`Failed to send ${kind} email:`, error);
    return { success: false, error };
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyLink = `${baseUrl}/api/auth/verify?token=${token}`;

  if (!resend) {
    warnNoEmailOnce();
    if (!consoleFallbackAllowed("verification")) {
      return { success: false, error: new Error("email not configured") };
    }
    console.log(`[email] Verification link for ${email}: ${verifyLink}`);
    return { success: true, data: null };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Verify your email for HSK Nest",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to HSK Nest!</h2>
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
