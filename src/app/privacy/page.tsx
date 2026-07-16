import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Recall",
  description: "Privacy Policy for Recall app.",
};

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

      <div className="prose prose-slate dark:prose-invert">
        <p className="lead">
          Last updated: July 16, 2026
        </p>

        <h2>1. Information We Collect</h2>
        <p>
          We only collect the information necessary to provide you with the Recall spaced-repetition service. This includes:
        </p>
        <ul>
          <li><strong>Account Data:</strong> Email address and encrypted password.</li>
          <li><strong>Usage Data:</strong> Flashcard study progress, review times, and algorithm parameters to schedule your next reviews.</li>
          <li><strong>Billing Data (paid plan only):</strong> Your subscription status and a customer reference at our payment processor. We never see or store your card number.</li>
        </ul>

        <h2>2. How We Use Your Information (Legal Bases)</h2>
        <p>
          Your data is exclusively used to make the application function. We do not sell your data, nor do we use it for targeted advertising. Where the GDPR applies, we process account, usage, and billing data because it is necessary to perform our contract with you (Art. 6(1)(b)), and send service emails (password resets, verification, trial status) on the basis of that contract and our legitimate interest in operating the service (Art. 6(1)(f)).
        </p>

        <h2>3. Processors We Use</h2>
        <p>
          A small number of service providers process data on our behalf, only as needed:
        </p>
        <ul>
          <li><strong>Stripe</strong> — payment processing for the hosted plan. Card details go directly to Stripe; we only receive a customer reference and subscription status.</li>
          <li><strong>Resend</strong> — delivery of transactional emails (password reset, email verification, trial status).</li>
          <li><strong>Umami (self-hosted)</strong> — privacy-friendly, cookieless page analytics running on our own server. No data is shared with any third party and no visitor is individually identified.</li>
        </ul>

        <h2>4. Cookies and Tracking</h2>
        <p>
          We use strictly necessary cookies to keep you logged in securely (NextAuth session cookies). Our analytics are cookieless. We do not use third-party tracking cookies by default without your explicit consent via our cookie banner.
        </p>

        <h2>5. Your Rights: Access, Export, and Deletion</h2>
        <p>
          You can exercise your data rights directly in the app, no email required: export your full study data as CSV at any time (Settings → Account), and delete your account and all associated data permanently (Settings → Account). These serve as our mechanisms for the GDPR rights of access (Art. 15) and erasure (Art. 17). Export remains available even after a subscription ends.
        </p>

        <h2>6. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at privacy+mail@markusberlit.de.
        </p>
      </div>
    </div>
  );
}
