import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | HSK Nest",
  description: "Terms of Service for HSK Nest app.",
};

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>

      <div className="prose prose-slate dark:prose-invert">
        <p className="lead">
          Last updated: July 16, 2026
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using the hosted HSK Nest service, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service. (Self-hosted installations of the open-source software are governed by the AGPL-3.0 license, not these Terms.)
        </p>

        <h2>2. Description of Service</h2>
        <p>
          HSK Nest is a language learning spaced-repetition application designed to help users memorize vocabulary efficiently. We reserve the right to modify or discontinue, temporarily or permanently, the service with or without notice. The service is provided &quot;as is&quot; without an uptime guarantee or service-level agreement, though we work hard to keep it fast and available.
        </p>

        <h2>3. User Accounts</h2>
        <p>
          When you create an account with us, you must provide accurate, complete, and current information. You are responsible for safeguarding the password that you use to access the service and for any activities or actions under your password.
        </p>

        <h2>4. Acceptable Use</h2>
        <p>
          You agree not to use the service for any unlawful purpose or in any way that interrupts, damages, or impairs the service. You may not attempt to gain unauthorized access to our computer systems or engage in any activity that disrupts or diminishes the quality of our service. You also may not scrape or bulk-extract content, resell access to the service, or abuse the free trial (for example by repeatedly creating accounts to avoid payment). We may suspend accounts that violate this section.
        </p>

        <h2>5. Content Ownership</h2>
        <p>
          The pre-loaded vocabulary lists (e.g., the HSK decks and example sentences) are provided as part of the service. You retain ownership of any custom lists you create. By making a custom list public, you grant us a license to distribute it to other users.
        </p>

        <h2>6. Free Trial</h2>
        <p>
          New accounts receive a 14-day free trial with full access. No payment method is collected for the trial, so you will never be charged automatically when it ends. When the trial expires, studying is paused but nothing is deleted: your decks, progress, and data export remain available, and you can subscribe at any time to continue.
        </p>

        <h2>7. Billing, Renewal, and Cancellation</h2>
        <p>
          The hosted plan costs €10 per month, billed as a recurring monthly subscription via our payment processor, Stripe. Your subscription renews automatically each month until cancelled. You can cancel at any time from Settings → Billing; cancellation takes effect at the end of the current billing period, and no further charges are made. We will give at least 30 days&apos; notice before any price change takes effect for existing subscribers.
        </p>

        <h2>8. Refunds</h2>
        <p>
          If HSK Nest isn&apos;t for you, we offer a no-questions-asked full refund within 14 days of your first payment — just contact us. This sits alongside, and does not limit, any rights you have under applicable consumer law (including the EU right of withdrawal and the Australian Consumer Law).
        </p>

        <h2>9. Consumer Guarantees</h2>
        <p>
          Our services come with guarantees that cannot be excluded under the Australian Consumer Law. Nothing in these Terms excludes, restricts, or modifies any consumer rights or guarantees that cannot lawfully be excluded, restricted, or modified.
        </p>

        <h2>10. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, and subject to Section 9, in no event shall HSK Nest, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
        </p>
      </div>
    </div>
  );
}
