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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { targetLanguageId: true },
  });
  if (!user) redirect("/login");

  if (!user.targetLanguageId) {
    redirect("/onboarding");
  }

  const [lists, progress, hiddenRows] = await Promise.all([
    prisma.wordList.findMany({
      where: {
        ...visibleListWhere(userId),
        ...(user.targetLanguageId ? { languageId: user.targetLanguageId } : {}),
      },
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
  const studying = lists
    .filter((l) => (byList.get(l.id)?.enrolled ?? 0) > 0 && !hiddenIds.has(l.id))
    .sort((a, b) => {
      const sa = byList.get(a.id) ?? { enrolled: 0, due: 0 };
      const sb = byList.get(b.id) ?? { enrolled: 0, due: 0 };
      return sb.due - sa.due || sb.enrolled - sa.enrolled || a.name.localeCompare(b.name);
    });
  const studyingIds = new Set(studying.map((l) => l.id));
  const ownLists = lists
    .filter((l) => l.createdById === userId && !studyingIds.has(l.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exploreLists = lists.filter(
    (l) =>
      l.createdById !== userId &&
      !studyingIds.has(l.id) &&
      !hiddenIds.has(l.id)
  );

  // Explore reads as a curriculum: graded exam levels first, then frequency
  // lists, then topic sets — instead of one undifferentiated grid.
  const exploreGroups = [
    { title: "By level", lists: exploreLists.filter((l) => /^HSK\b/i.test(l.name)) },
    { title: "By frequency", lists: exploreLists.filter((l) => /\bTop \d+/i.test(l.name)) },
  ];
  const grouped = new Set(exploreGroups.flatMap((g) => g.lists.map((l) => l.id)));
  exploreGroups.push({
    title: "By topic",
    lists: exploreLists
      .filter((l) => !grouped.has(l.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
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
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 text-3xl font-extrabold tracking-tight">Word lists</h1>
          <p className="text-base text-muted-foreground">
            Create your own lists, or add words from a starter set to your queue.
          </p>
        </div>
        <Button asChild className="rounded-full px-6 shadow-sm transition-transform active:scale-95">
          <Link href="/lists/new">＋ New list</Link>
        </Button>
      </div>

      {studying.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            Studying
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {studying.map((l) => card(l))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
          Your lists
        </h2>
        {ownLists.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ownLists.map((l) => card(l))}
          </div>
        ) : studyingIds.size === 0 || studying.every((l) => l.createdById !== userId) ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              You haven&apos;t created any lists yet.{" "}
              <Link href="/lists/new" className="font-semibold text-primary underline-offset-4 hover:underline">
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
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
          Explore
        </h2>
        {exploreLists.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No starter lists available yet.{" "}
              <Link href="/lists/new" className="text-primary underline-offset-4 hover:underline">
                Create a custom list
              </Link>{" "}
              to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {exploreGroups
              .filter((g) => g.lists.length > 0)
              .map((g) => (
                <div key={g.title}>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    {g.title}
                  </h3>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {g.lists.map((l) => card(l))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {hiddenLists.length > 0 && (
        <details className="mt-12 group">
          <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-wider text-muted-foreground/80 transition-colors hover:text-foreground">
            <span className="flex items-center gap-2">
              <span className="transition-transform group-open:rotate-90">▶</span>
              Hidden ({hiddenLists.length})
            </span>
          </summary>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 opacity-60 transition-opacity hover:opacity-100">
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
    <Link href={`/lists/${id}`} className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
      <Card className="relative flex h-full flex-col overflow-hidden bg-card transition-colors duration-200 hover:border-primary/30 hover:bg-accent/40">
        <CardContent className="flex flex-1 flex-col p-5">
          {/* Top row: name + language on the left, hide toggle pinned right. */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <p className="truncate text-base font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                  {name}
                </p>
                {owner && (
                  <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    Yours
                  </span>
                )}
              </div>
              <p className="truncate text-sm font-medium text-muted-foreground/80">{languageName}</p>
            </div>
            {hideable && (
              <div className="relative z-10 shrink-0 -mt-1 -mr-1">
                <ListVisibilityButton listId={id} hidden={hidden} />
              </div>
            )}
          </div>

          {/* Spacer to push stats to bottom */}
          <div className="mt-auto pt-4 border-t border-border/40">
            <div className="flex flex-wrap items-center gap-2">
              {due > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  {due} due
                </span>
              )}
              {enrolled > 0 && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {enrolled} learning
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-secondary/80 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {wordCount} words
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
