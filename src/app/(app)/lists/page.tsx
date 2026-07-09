import Link from "next/link";
import { redirect } from "next/navigation";

import { ListVisibilityButton } from "@/components/lists/ListVisibilityButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { visibleListWhere } from "@/lib/ownership";

export default async function ListsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const [lists, progress, hiddenRows] = await Promise.all([
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
    prisma.hiddenList.findMany({
      where: { userId },
      select: { listId: true },
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

  const hiddenIds = new Set(hiddenRows.map((h) => h.listId));

  // Sections, in reading order: what you study, what you made, what you could
  // add, what you tucked away. Hidden wins over studying (so hiding stops study).
  const studying = lists.filter(
    (l) => (byList.get(l.id)?.enrolled ?? 0) > 0 && !hiddenIds.has(l.id)
  );
  const studyingIds = new Set(studying.map((l) => l.id));
  const ownLists = lists.filter(
    (l) => l.createdById === userId && !studyingIds.has(l.id)
  );
  const exploreLists = lists.filter(
    (l) =>
      l.createdById !== userId &&
      !studyingIds.has(l.id) &&
      !hiddenIds.has(l.id)
  );
  const hiddenLists = lists.filter(
    (l) => l.createdById !== userId && hiddenIds.has(l.id)
  );

  const card = (list: (typeof lists)[number], opts?: { hidden?: boolean }) => (
    <ListCard
      key={list.id}
      id={list.id}
      name={list.name}
      languageName={list.language.name}
      wordCount={list._count.words}
      enrolled={byList.get(list.id)?.enrolled ?? 0}
      due={byList.get(list.id)?.due ?? 0}
      owner={list.createdById === userId}
      hideable={list.createdById !== userId}
      hidden={opts?.hidden ?? false}
    />
  );

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

      {studying.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Studying
          </h2>
          <div className="space-y-3">{studying.map((l) => card(l))}</div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your lists
        </h2>
        {ownLists.length > 0 ? (
          <div className="space-y-3">{ownLists.map((l) => card(l))}</div>
        ) : studyingIds.size === 0 || studying.every((l) => l.createdById !== userId) ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              You haven&apos;t created any lists yet.{" "}
              <Link href="/lists/new" className="text-primary underline-offset-4 hover:underline">
                Create one
              </Link>{" "}
              to add your own words.
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            All your lists are in Studying above.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Explore
        </h2>
        <div className="space-y-3">
          {exploreLists.map((l) => card(l))}
          {exploreLists.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No starter lists available yet.
            </p>
          )}
        </div>
      </section>

      {hiddenLists.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Hidden ({hiddenLists.length})
          </summary>
          <div className="mt-3 space-y-3 opacity-70">
            {hiddenLists.map((l) => card(l, { hidden: true }))}
          </div>
        </details>
      )}
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
  hideable = false,
  hidden = false,
}: {
  id: string;
  name: string;
  languageName: string;
  wordCount: number;
  enrolled: number;
  due: number;
  owner?: boolean;
  hideable?: boolean;
  hidden?: boolean;
}) {
  return (
    <Link href={`/lists/${id}`} className="block">
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="py-4">
          {/* Top row: name + language on the left, hide toggle pinned right. */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{name}</p>
                {owner && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Yours
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{languageName}</p>
            </div>
            {hideable && (
              <div className="shrink-0">
                <ListVisibilityButton listId={id} hidden={hidden} />
              </div>
            )}
          </div>

          {/* Stats wrap onto their own line so they never crowd the name. */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
