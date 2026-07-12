import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AssumeButton } from "@/components/lists/AssumeButton";
import { EnrollButton } from "@/components/lists/EnrollButton";
import { Button } from "@/components/ui/button";
import { ListManageBar } from "@/components/lists/ListManageBar";
import { ListWordsView } from "@/components/lists/ListWordsView";
import { UnenrollButton } from "@/components/lists/UnenrollButton";
import { prisma } from "@/lib/prisma";
import { termKey } from "@/lib/progressMerge";
import { getCurrentUserId } from "@/lib/session";
import { visibleListWhere } from "@/lib/ownership";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const { id } = await params;

  const list = await prisma.wordList.findFirst({
    where: { id, ...visibleListWhere(userId) },
    include: {
      language: { select: { name: true, code: true } },
      words: { orderBy: { position: "asc" } },
    },
  });
  if (!list) notFound();

  const isOwner = list.createdById === userId;

  // Progress is shared per term+language: fetch all rows in this language so
  // a twin word tracked via another list still shows its strength here.
  const allProgress = await prisma.userProgress.findMany({
    where: { userId, word: { wordList: { languageId: list.languageId } } },
    select: {
      wordId: true,
      state: true,
      intervalDays: true,
      lapses: true,
      dueAt: true,
      lastReviewedAt: true,
      word: { select: { term: true } },
    },
  });
  const progressByWord = new Map(allProgress.map((p) => [p.wordId, p]));
  const progressByTerm = new Map(
    allProgress.map((p) => [termKey(p.word.term), p])
  );
  const progress = list.words
    .map((w) => progressByWord.get(w.id) ?? progressByTerm.get(termKey(w.term)))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const words = list.words.map((w) => {
    const p = progressByWord.get(w.id) ?? progressByTerm.get(termKey(w.term));
    return {
      id: w.id,
      term: w.term,
      translation: w.translation,
      metadata: w.metadata,
      phonetic: w.phonetic,
      state: p?.state ?? null,
      intervalDays: p?.intervalDays ?? null,
      lapses: p?.lapses ?? null,
      dueAt: p?.dueAt ? p.dueAt.toISOString() : null,
      lastReviewedAt: p?.lastReviewedAt ? p.lastReviewedAt.toISOString() : null,
    };
  });

  const allEnrolled =
    list.words.length > 0 && progress.length === list.words.length;

  const now = new Date();
  const strongCount = progress.filter(
    (p) => p.state === "REVIEW" || p.state === "MASTERED"
  ).length;
  const dueCount = progress.filter(
    (p) => p.state !== "NEW" && p.state !== "ASSUMED" && p.dueAt <= now
  ).length;
  const strongPct =
    progress.length > 0 ? Math.round((strongCount / progress.length) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <Link
        href="/lists"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All lists
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{list.name}</h1>
          <p className="text-sm text-muted-foreground">
            {list.language.name} · {list.words.length} words
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Study just this list (the dashboard has no per-list scope). */}
            {progress.length > 0 && (
              <Button asChild>
                <Link href={`/study?listIds=${list.id}&limit=500`}>
                  <GraduationCap className="size-4" />
                  Study this list
                </Link>
              </Button>
            )}
            <EnrollButton listId={list.id} allEnrolled={allEnrolled} />
          </div>
          <p className="max-w-xs text-right text-xs text-muted-foreground">
            Add all to my queue puts these words into your daily study rotation.
          </p>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <AssumeButton listId={list.id} />
            <UnenrollButton listId={list.id} enrolledCount={progress.length} />
          </div>
        </div>
      </div>

      {list.description && (
        <p className="mt-2 text-sm text-muted-foreground">{list.description}</p>
      )}

      {progress.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
            {progress.length} of {list.words.length} in your queue
          </span>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
            {strongPct}% strong
          </span>
          {dueCount > 0 && (
            <span className="rounded-full bg-amber/15 px-2.5 py-1 text-amber">
              {dueCount} due now
            </span>
          )}
        </div>
      )}

      {isOwner && (
        <div className="mt-6">
          <ListManageBar
            listId={list.id}
            name={list.name}
            description={list.description}
          />
        </div>
      )}

      <div className="mt-6">
        <ListWordsView
          words={words}
          listId={list.id}
          isOwner={isOwner}
          languageCode={list.language.code}
          languageName={list.language.name}
        />
      </div>
    </main>
  );
}
