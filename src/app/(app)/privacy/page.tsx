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
          Last updated: July 8, 2026
        </p>

        <h2>1. Information We Collect</h2>
        <p>
          We only collect the information necessary to provide you with the Recall spaced-repetition service. This includes:
        </p>
        <ul>
          <li><strong>Account Data:</strong> Email address and encrypted password.</li>
          <li><strong>Usage Data:</strong> Flashcard study progress, review times, and algorithm parameters to schedule your next reviews.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>
          Your data is exclusively used to make the application function. We do not sell your data, nor do we use it for targeted advertising. The study data you generate is used to optimize your learning path.
        </p>

        <h2>3. Cookies and Tracking</h2>
        <p>
          We use strictly necessary cookies to keep you logged in securely (NextAuth session cookies). We do not use third-party tracking cookies by default without your explicit consent via our cookie banner.
        </p>

        <h2>4. Data Retention and Deletion</h2>
        <p>
          You have the right to request deletion of your account and all associated study data at any time. If you delete your account, all personal data is permanently removed from our databases.
        </p>

        <h2>5. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at privacy+mail@markusberlit.de.
        </p>
      </div>
    </div>
  );
}
