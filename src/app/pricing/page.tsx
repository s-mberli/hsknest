import { Check } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

import { TryFreeButton } from "@/components/landing/TryFreeButton";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing | HSK Nest",
  description:
    "HSK Nest Hosted is €10/month with a 14-day free trial — no credit card to start. Or self-host it free, forever.",
};

const GITHUB_URL = "https://github.com/s-mberli/hsknest";

const ROWS: { label: string; selfHost: string; hosted: string }[] = [
  { label: "Price", selfHost: "Free forever (AGPL)", hosted: "€10/month" },
  { label: "Setup", selfHost: "Your server, Docker, DNS", hosted: "None — sign up and study" },
  { label: "Updates", selfHost: "You pull and redeploy", hosted: "Automatic" },
  { label: "Backups", selfHost: "You configure them", hosted: "Nightly, managed" },
  { label: "Uptime", selfHost: "Your responsibility", hosted: "Monitored for you" },
  { label: "All features & decks", selfHost: "Included", hosted: "Included" },
  { label: "Data export (CSV)", selfHost: "Anytime", hosted: "Anytime — even after cancelling" },
];

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-12 px-6 py-16">
      <header className="space-y-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Simple pricing, no lock-in
        </h1>
        <p className="text-lg text-muted-foreground">
          One plan. 14 days free, no credit card to start, cancel in one
          click.
        </p>
      </header>

      {/* Comparison */}
      <section className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-4 font-medium" />
              <th className="p-4 font-semibold">Self-hosted</th>
              <th className="p-4 font-semibold text-primary">Hosted</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ label, selfHost, hosted }) => (
              <tr key={label} className="border-b last:border-0">
                <td className="p-4 font-medium">{label}</td>
                <td className="p-4 text-muted-foreground">{selfHost}</td>
                <td className="p-4">{hosted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Trial mechanics — spelled out, no surprises */}
      <section className="space-y-4 rounded-2xl border bg-card p-6">
        <h2 className="text-xl font-bold tracking-tight">
          How the trial works
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "14 days, full access, no credit card collected — so there is no surprise charge when it ends.",
            "When the trial ends, studying pauses but nothing is deleted: your decks, progress, and CSV export stay available.",
            "Upgrade any time for €10/month. Cancel any time in one click — no retention flows, no guilt emails.",
            "14-day no-questions refund on your first payment.",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* Why not free hosted */}
      <section className="mx-auto max-w-xl space-y-2 text-center text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">
          Why isn&apos;t hosting free too?
        </h2>
        <p>
          Servers, backups, and updates cost real money and time. €10/month
          keeps the hosted service fast and maintained — and funds continued
          development of the open-source project everyone gets for free.
        </p>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center gap-4">
        <TryFreeButton>Start your 14-day free trial</TryFreeButton>
        <Button asChild variant="ghost" size="sm">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            or self-host free on GitHub
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          More questions? See the{" "}
          <Link
            href="/#pricing"
            className="underline underline-offset-2 hover:text-foreground"
          >
            FAQ on the homepage
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
