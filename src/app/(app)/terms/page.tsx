import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Recall",
  description: "Terms of Service for Recall app.",
};

export default function TermsPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      
      <div className="prose prose-slate dark:prose-invert">
        <p className="lead">
          Last updated: July 8, 2026
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using Recall, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          Recall is a language learning spaced-repetition application designed to help users memorize vocabulary efficiently. We reserve the right to modify or discontinue, temporarily or permanently, the service with or without notice.
        </p>

        <h2>3. User Accounts</h2>
        <p>
          When you create an account with us, you must provide accurate, complete, and current information. You are responsible for safeguarding the password that you use to access the service and for any activities or actions under your password.
        </p>

        <h2>4. Acceptable Use</h2>
        <p>
          You agree not to use the service for any unlawful purpose or in any way that interrupts, damages, or impairs the service. You may not attempt to gain unauthorized access to our computer systems or engage in any activity that disrupts or diminishes the quality of our service.
        </p>

        <h2>5. Content Ownership</h2>
        <p>
          The original starter lists provided (e.g., German, Chinese, Spanish essentials) are provided as part of the service. You retain ownership of any custom lists you create. By making a custom list public, you grant us a license to distribute it to other users.
        </p>

        <h2>6. Limitation of Liability</h2>
        <p>
          In no event shall Recall, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
        </p>
      </div>
    </div>
  );
}
