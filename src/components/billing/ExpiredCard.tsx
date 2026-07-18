"use client";

import { Download, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Replaces the dashboard hero once the hosted trial is over and no plan is
 * active. Deliberately no dark patterns: data stays, export stays, the
 * consent line covers the EU withdrawal-right acknowledgment.
 */
export function ExpiredCard() {
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);

  async function upgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "failed");
      window.location.href = data.url;
    } catch {
      toast.error("Could not start checkout — please try again.");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Lock className="size-5 text-muted-foreground" />
        </span>
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">
            Your trial has ended — your progress hasn&apos;t
          </h2>
          <p className="text-sm text-muted-foreground">
            All your decks and review history are saved. Upgrade for €10/month
            to keep studying, or export your data anytime.
          </p>
        </div>

        <label className="flex max-w-sm items-start gap-2 text-left text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
          />
          I agree to immediate provision of the service and acknowledge that my
          right of withdrawal ends when billing starts. 14-day no-questions
          refund still applies.
        </label>

        <div className="flex flex-wrap justify-center gap-3">
          <Button disabled={!consented || loading} onClick={upgrade}>
            {loading ? "Opening checkout…" : "Upgrade — €10/mo"}
          </Button>
          <Button asChild variant="outline">
            <a href="/api/account/export" download>
              <Download className="size-4" />
              Export my data
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
