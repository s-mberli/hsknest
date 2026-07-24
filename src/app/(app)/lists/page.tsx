import Link from "next/link";
import { redirect } from "next/navigation";

import { ListVisibilityButton } from "@/components/lists/ListVisibilityButton";
import { PriorityControls } from "@/components/lists/PriorityControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { buildListSections } from "@/lib/listSections";
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

  const [lists, progress, hiddenRows, priorityRows] = await Promise.all([
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
    prisma.listPriority.findMany({
      where: { userId },
      orderBy: { rank: "asc" },
      select: { wordListId: true },
    }),
  ]);

  const {
    studying,
    studyingOrder,
    ownLists,
    exploreGroups,
    hiddenLists,
    byList,
    studyingIds,
  } = buildListSections({
    lists,
    progress,
    hiddenListIds: hiddenRows.map((h) => h.listId),
    priorityListIds: priorityRows.map((p) => p.wordListId),
    userId,
    now: new Date(),
  });

  const card = (
    list: (typeof lists)[number],
    opts?: { hidden?: boolean; studying?: boolean }
  ) => (
    <ListCard
      key={list.id}
      id={list.id}
      name={list.name}
      languageName={list.language.name}
      wordCount={list._count.words}
      enrolled={byList.get(list.id)?.enrolled ?? 0}
      due={byList.get(list.id)?.due ?? 0}
      owner={list.createdById === userId}
      hideable={list.createdById !== userId && !studyingIds.has(list.id)}
      hidden={opts?.hidden ?? false}
      studying={opts?.studying ?? false}
      rank={opts?.studying ? studyingOrder.indexOf(list.id) + 1 : undefined}
      studyingOrder={opts?.studying ? studyingOrder : undefined}
      showRankControls={opts?.studying && studying.length > 1}
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
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            Studying
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            The top of this stack feeds your new words. Reviews always come
            first, wherever they live.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {studying.map((l) => card(l, { studying: true }))}
          </div>
        </section>
      )}

      {ownLists.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            Your lists
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ownLists.map((l) => card(l))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
          Explore
        </h2>
        {exploreGroups.every((g) => g.lists.length === 0) ? (
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
  studying = false,
  rank,
  studyingOrder,
  showRankControls = false,
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
  studying?: boolean;
  rank?: number;
  studyingOrder?: string[];
  showRankControls?: boolean;
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

          {studying && showRankControls && rank !== undefined && studyingOrder && (
            <div className="relative z-10 mb-3">
              <PriorityControls listId={id} rank={rank} order={studyingOrder} />
            </div>
          )}

          {/* Spacer to push stats to bottom */}
          <div className="mt-auto pt-4 border-t border-border/40">
            {studying ? (
              <p className="text-xs font-medium text-muted-foreground">
                {due > 0 && (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {due} due
                  </span>
                )}
                {due > 0 && " · "}
                {enrolled}/{wordCount}
              </p>
            ) : (
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
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
