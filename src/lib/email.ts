import { Resend } from "resend";

import { isSelfHosted } from "@/lib/selfHosted";

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
  if (isSelfHosted()) return true;
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
        <p>To keep studying without a break, you can lock in the €99/year Founder's Rate or upgrade for €10/month (cancel anytime, 14-day refund).</p>
        <p><a href="${baseUrl}/settings#billing" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Manage your plan</a></p>`,
    },
    trial_ended: {
      subject: "Your HSK Nest trial has ended — your progress hasn't",
      body: `
        <h2>Your trial has ended</h2>
        <p>Everything you studied is saved. You can export your full progress as CSV anytime, upgrade to lock in the €99/year Founder's Rate to continue, or self-host the open-source version for free.</p>
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

/**
 * Weekly declining-engagement nudge (hosted instance only) — see
 * scripts/check-declining-engagement.ts and src/lib/engagementDecline.ts.
 * Tone deliberately matches the source ("we noticed", not "you're failing
 * your streak") — Gym Launch Secrets ch.16 frames the equivalent reach-out
 * as praise-and-check-in, not guilt.
 */
export async function sendDeclineNudgeEmail(email: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const subject = "Haven't seen you in a bit";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Your words are exactly where you left them</h2>
      <p>Looks like studying slipped a bit this week — totally normal, life happens. Nothing's lost; your progress is saved and waiting.</p>
      <p>A few minutes today is enough to pick the thread back up before it gets harder to.</p>
      <p><a href="${baseUrl}/study" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Continue studying</a></p>
      <p style="color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 16px;">
        You're receiving this because your study activity dropped this week. Manage or delete your account anytime in
        <a href="${baseUrl}/settings">Settings</a> — deleting it stops all email immediately.
      </p>
    </div>`;

  if (!resend) {
    warnNoEmailOnce();
    console.log(`[email] decline_nudge for ${email}: ${subject}`);
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
      console.error("Error sending decline nudge email:", error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send decline nudge email:", error);
    return { success: false, error };
  }
}

/**
 * One honest question on cancellation (hosted instance only) — see
 * customer.subscription.deleted in src/app/api/billing/webhook/route.ts.
 * Gym Launch Secrets ch.16, "Exit Interviews": "we want to know what went
 * wrong or what went right... even if you were totally satisfied." Best
 * effort, never blocks or gates the cancellation itself.
 */
export async function sendCancellationSurveyEmail(email: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const subject = "Before you go — what happened?";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Sorry to see you go</h2>
      <p>We'd genuinely like to know what didn't work for you — even if it was nothing we could have fixed. It's the only way we get better.</p>
      <p><a href="${baseUrl}/settings#feedback" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Tell us in 30 seconds</a></p>
      <p>Or just reply to this email — a real person reads these.</p>
      <p style="color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 16px;">
        Your account and progress are untouched — you can resubscribe anytime in
        <a href="${baseUrl}/settings">Settings</a>.
      </p>
    </div>`;

  if (!resend) {
    warnNoEmailOnce();
    console.log(`[email] cancellation_survey for ${email}: ${subject}`);
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
      console.error("Error sending cancellation survey email:", error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send cancellation survey email:", error);
    return { success: false, error };
  }
}

/**
 * Upgrade confirmation email sent when a subscription is successfully activated.
 * Best-effort only — this email is not critical to the upgrade flow.
 */
export async function sendUpgradeConfirmationEmail(email: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const subject = "Welcome to HSK Nest Premium!";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to HSK Nest Premium! 🎉</h2>
      <p>Your subscription is active. You now have unlimited access to:</p>
      <ul style="line-height: 1.8; color: #333;">
        <li>All HSK 1–9 vocabulary lists</li>
        <li>Full example sentence library (3,000+ curated sentences)</li>
        <li>Advanced scheduling options (FSRS, SM-2, Leitner)</li>
        <li>Data export and progress analytics</li>
        <li>Multiple lists and languages</li>
      </ul>
      <p style="margin-top: 24px;">
        <a href="${baseUrl}/dashboard" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Go to your dashboard</a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 16px;">
        Questions? Check out <a href="${baseUrl}/help">our help center</a> or reply to this email.
      </p>
    </div>`;

  if (!resend) {
    warnNoEmailOnce();
    console.log(`[email] upgrade_confirmation for ${email}: ${subject}`);
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
      console.error("Error sending upgrade confirmation email:", error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send upgrade confirmation email:", error);
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
