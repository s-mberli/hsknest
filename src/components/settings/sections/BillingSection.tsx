"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SettingRow } from "./shared";

/**
 * Hosted-plan billing controls. Never rendered on self-hosted installs
 * (the settings page checks getSubscriptionInfo().selfHosted first).
 */
export function BillingSection({
  status,
  daysLeft,
  hasStripeCustomer,
}: {
  status: string;
  daysLeft: number | null;
  hasStripeCustomer: boolean;
}) {
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);

  const trialing = status === "trialing";
  const active = status === "active";

  const statusLabel = active
    ? "Recall Hosted — €5/month"
    : trialing
      ? daysLeft !== null
        ? `Free trial — ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`
        : "Free trial"
      : status === "past_due"
        ? "Payment problem — please update your card"
        : "No active plan";

  async function post(path: string, failMessage: string) {
    setLoading(true);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "failed");
      window.location.href = data.url;
    } catch {
      toast.error(failMessage);
      setLoading(false);
    }
  }

  return (
    <Card id="billing">
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>
          Your hosted plan. Cancel anytime — your data and export stay
          available either way.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <SettingRow name="Plan" description={statusLabel}>
          {active || hasStripeCustomer ? (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() =>
                post("/api/billing/portal", "Could not open the billing portal.")
              }
            >
              Manage
            </Button>
          ) : null}
        </SettingRow>

        {!active && (
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
              />
              I agree to immediate provision of the service and acknowledge
              that my right of withdrawal ends when billing starts. 14-day
              no-questions refund still applies.
            </label>
            <Button
              disabled={!consented || loading}
              onClick={() =>
                post("/api/billing/checkout", "Could not start checkout.")
              }
            >
              {loading ? "Opening checkout…" : "Upgrade — €5/mo"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
