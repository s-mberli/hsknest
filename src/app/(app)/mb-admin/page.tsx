import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/**
 * Minimal read-only operator dashboard. Deliberately at an unadvertised
 * path and gated by ADMIN_EMAIL: anyone else (or an unset env) gets a 404,
 * indistinguishable from the page not existing.
 */
export default async function AdminPage() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) notFound();

  const userId = await getCurrentUserId();
  if (!userId) notFound();

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!me || me.email.toLowerCase() !== adminEmail.toLowerCase()) notFound();

  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 86_400_000);

  const [totalUsers, guests, activeSubs, trialing, expiringSoon, wordReports, feedback] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { email: { endsWith: "@guest.local" } } }),
      prisma.user.count({ where: { subscriptionStatus: "active" } }),
      prisma.user.count({
        where: { subscriptionStatus: "trialing", trialEndsAt: { gt: now } },
      }),
      prisma.user.count({
        where: {
          subscriptionStatus: "trialing",
          trialEndsAt: { gt: now, lte: in7d },
        },
      }),
      prisma.feedback.count({ where: { category: "word" } }),
      prisma.feedback.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          category: true,
          message: true,
          page: true,
          status: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
    ]);

  const stats: { label: string; value: string }[] = [
    { label: "Users (total)", value: String(totalUsers) },
    { label: "— of which guests", value: String(guests) },
    { label: "Active subscriptions", value: String(activeSubs) },
    { label: "MRR (est.)", value: `€${activeSubs * 10}` },
    { label: "In trial", value: String(trialing) },
    { label: "Trials ending ≤7d", value: String(expiringSoon) },
    { label: "Word-quality reports", value: String(wordReports) },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Operations</h1>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-5 text-center">
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Word-quality reports (card flags from study mode) */}
      {wordReports > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">
            Word-quality reports ({wordReports} total)
          </h2>
          <ul className="mb-8 space-y-3">
            {feedback
              .filter((f) => f.category === "word")
              .map((f) => (
                <li key={f.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-300/90">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium dark:bg-amber-900/50">
                      word
                    </span>
                    <span>{f.user.email}</span>
                    {f.page && <span>· {f.page}</span>}
                    <span>· {f.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                    {f.status !== "open" && <span>· {f.status}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-foreground">{f.message}</p>
                </li>
              ))}
          </ul>
        </>
      )}

      {/* General feedback (bugs, ideas, etc.) */}
      <h2 className="mb-3 text-lg font-semibold">
        General feedback ({feedback.filter((f) => f.category !== "word").length} latest)
      </h2>
      {feedback.filter((f) => f.category !== "word").length === 0 ? (
        <p className="text-sm text-muted-foreground">No general feedback yet.</p>
      ) : (
        <ul className="space-y-3">
          {feedback
            .filter((f) => f.category !== "word")
            .map((f) => (
              <li key={f.id} className="rounded-xl border bg-card p-4 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                    {f.category}
                  </span>
                  <span>{f.user.email}</span>
                  {f.page && <span>· {f.page}</span>}
                  <span>· {f.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                  {f.status !== "open" && <span>· {f.status}</span>}
                </div>
                <p className="whitespace-pre-wrap">{f.message}</p>
              </li>
            ))}
        </ul>
      )}
    </main>
  );
}
