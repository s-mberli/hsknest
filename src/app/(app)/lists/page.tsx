import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { visibleListWhere } from "@/lib/ownership";

export default async function ListsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const [lists, progress] = await Promise.all([
    prisma.wordList.findMany({
      where: visibleListWhere(userId),
      orderBy: { createdAt: "asc" },
      include: {
        language: { select: { name: true, code: true } },
        _count: { select: { words: true } },
      },
    }),
    prisma.userProgress.findMany({
      where: { userId },
      select: {
        state: true,
        dueAt: true,
        word: { select: { wordListId: true } },
      },
    }),
  ]);

  // Per-list rollup: how many of its words are in the queue, how many due.
  const now = new Date();
  const byList = new Map<string, { enrolled: number; due: number }>();
  for (const p of progress) {
    const key = p.word.wordListId;
    const entry = byList.get(key) ?? { enrolled: 0, due: 0 };
    entry.enrolled += 1;
    if (p.state !== "NEW" && p.state !== "ASSUMED" && p.dueAt <= now) {
      entry.due += 1;
    }
    byList.set(key, entry);
  }

  const ownLists = lists.filter((l) => l.createdById === userId);
  const exploreLists = lists.filter((l) => l.createdById !== userId);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight">Word lists</h1>
          <p className="text-sm text-muted-foreground">
            Create your own lists, or add words from a starter set to your queue.
          </p>
        </div>
        <Button asChild>
          <Link href="/lists/new">＋ New list</Link>
        </Button>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your lists
        </h2>
        {ownLists.length > 0 ? (
          <div className="space-y-3">
            {ownLists.map((list) => (
              <ListCard
                key={list.id}
                id={list.id}
                name={list.name}
                languageName={list.language.name}
                wordCount={list._count.words}
                enrolled={byList.get(list.id)?.enrolled ?? 0}
                due={byList.get(list.id)?.due ?? 0}
                owner
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              You haven&apos;t created any lists yet.{" "}
              <Link href="/lists/new" className="text-primary underline-offset-4 hover:underline">
                Create one
              </Link>{" "}
              to add your own words.
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Explore
        </h2>
        <div className="space-y-3">
          {exploreLists.map((list) => (
            <ListCard
              key={list.id}
              id={list.id}
              name={list.name}
              languageName={list.language.name}
              wordCount={list._count.words}
              enrolled={byList.get(list.id)?.enrolled ?? 0}
              due={byList.get(list.id)?.due ?? 0}
            />
          ))}
          {exploreLists.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No starter lists available yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function ListCard({
  id,
  name,
  languageName,
  wordCount,
  enrolled,
  due,
  owner = false,
}: {
  id: string;
  name: string;
  languageName: string;
  wordCount: number;
  enrolled: number;
  due: number;
  owner?: boolean;
}) {
  return (
    <Link href={`/lists/${id}`} className="block">
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{name}</p>
              {owner && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Yours
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{languageName}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {due > 0 && (
              <span className="rounded-full bg-amber/15 px-2.5 py-1 text-xs font-medium text-amber">
                {due} due
              </span>
            )}
            {enrolled > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {enrolled} learning
              </span>
            )}
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {wordCount} words
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
