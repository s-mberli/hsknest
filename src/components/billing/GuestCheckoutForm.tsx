"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { trackEvent } from "@/lib/analytics";
import { guestCheckoutSchema } from "@/lib/validation";

export function GuestCheckoutForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent, interval: "monthly" | "yearly") => {
    e.preventDefault();
    if (!consent) {
      setError("Please acknowledge the right of withdrawal.");
      return;
    }

    setLoading(true);
    setError(null);

    const parsed = guestCheckoutSchema.safeParse({ email, password, interval });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/billing/guest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, interval }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      await signIn("credentials", { email, password, redirect: false });
      
      trackEvent("guest_checkout_redirect");
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
        Upgrade to Full Account
      </h3>
      
      <form>
        <div className="mb-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Email Address
            </label>
            <input
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              placeholder="Min. 8 characters"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              required
              disabled={loading}
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              I consent to immediate access to the service and acknowledge that I
              lose my right of withdrawal upon access.
            </span>
          </label>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={loading}
            onClick={(e) => handleSubmit(e, "monthly")}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Upgrade Monthly (€10/mo)
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={(e) => handleSubmit(e, "yearly")}
            className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Upgrade Yearly (€99/yr)
          </button>
        </div>
      </form>
    </div>
  );
}
