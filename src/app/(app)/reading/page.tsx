import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TRACKED_STATES } from "@/lib/cardStates";
import { prisma } from "@/lib/prisma";
import { computeCoverage, fitLabel, pickBestFit, toKnownTermKeys, type FitLabel } from "@/lib/reading/coverage";
import { getCurrentUserId } from "@/lib/session";

const FIT_STYLE: Record<FitLabel, string> = {
  "too-easy": "bg-muted text-muted-foreground",
  "just-right": "bg-success/15 text-success",
  challenging: "bg-amber/15 text-amber",
  "too-hard": "bg-destructive/10 text-destructive",
};

export default async function ReadingPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const texts = await prisma.readingText.findMany({
    where: { status: "published" },
    orderBy: [{ level: "asc" }, { title: "asc" }],
    include: { audio: true },
  });

  const levels = [...new Set(texts.map((t) => t.level))].sort((a, b) => a - b);

  // Fetch user's progress for all texts
  const progressRows = await prisma.readingProgress.findMany({
    where: { userId, textId: { in: texts.map((t) => t.id) } },
    select: { textId: true, lastPosition: true, completedAt: true },
  });
  const progressMap = new Map(progressRows.map((r) => [r.textId, r]));

  // Find continue-reading story (first in-progress)
  const continueStory = texts.find((t) => {
    const p = progressMap.get(t.id);
    return p && !p.completedAt && p.lastPosition > 0;
  });
  const continueProgress = continueStory ? progressMap.get(continueStory.id) : null;

  // Comprehensible-input coverage: for each text, what fraction of its
  // distinct vocabulary does this reader already know? Reuses
  // ReadingTextWord (per-text lemma index, written at ingest — previously
  // had zero readers anywhere) and UserProgress (same source
  // /api/reading/known-words uses for the reader's dimming overlay).
  // Scoped per languageId so a multi-language deck can't inflate a story's
  // number with unrelated-language vocabulary.
  const languageIds = [...new Set(texts.map((t) => t.languageId))];
  const [textWords, progressTerms] = await Promise.all([
    prisma.readingTextWord.findMany({
      where: { textId: { in: texts.map((t) => t.id) } },
      select: { textId: true, lemma: true },
    }),
    prisma.userProgress.findMany({
      // Only words actually met, not merely enrolled — enrolling a list
      // bulk-creates a NEW row per word (see enroll/route.ts), so without
      // this filter every enrolled-but-unstudied word reads as "known" and
      // coverage/pickBestFit degenerate toward 100% for anyone who enrolls
      // curriculum lists upfront (the normal way to use the app). Matches
      // /api/reading/known-words, which already scopes correctly.
      where: {
        userId,
        state: { in: [...TRACKED_STATES] },
        word: { wordList: { languageId: { in: languageIds } } },
      },
      select: { word: { select: { term: true, wordList: { select: { languageId: true } } } } },
    }),
  ]);

  const lemmasByText = new Map<string, string[]>();
  for (const w of textWords) {
    const arr = lemmasByText.get(w.textId);
    if (arr) arr.push(w.lemma);
    else lemmasByText.set(w.textId, [w.lemma]);
  }

  const termsByLanguage = new Map<string, string[]>();
  for (const p of progressTerms) {
    const langId = p.word.wordList.languageId;
    const arr = termsByLanguage.get(langId);
    if (arr) arr.push(p.word.term);
    else termsByLanguage.set(langId, [p.word.term]);
  }
  const knownTermKeysByLanguage = new Map<string, Set<string>>();
  for (const [langId, terms] of termsByLanguage) {
    knownTermKeysByLanguage.set(langId, toKnownTermKeys(terms));
  }

  const coverageByText = new Map<string, { pct: number | null; knownCount: number; totalCount: number }>();
  for (const t of texts) {
    const known = knownTermKeysByLanguage.get(t.languageId) ?? new Set<string>();
    coverageByText.set(t.id, computeCoverage(lemmasByText.get(t.id) ?? [], known));
  }

  // Best-fit recommendation: closest to the ideal comprehension band, among
  // texts the reader hasn't already completed (continue-reading, if any,
  // takes priority in the UI — this is a distinct "what's next" surface).
  const unreadTexts = texts.filter((t) => !progressMap.get(t.id)?.completedAt);
  const bestFit = pickBestFit(
    unreadTexts.map((t) => ({ id: t.id, pct: coverageByText.get(t.id)?.pct ?? null }))
  );
  const bestFitText = bestFit ? texts.find((t) => t.id === bestFit.id) : null;

  // Karaoke audio is a separate, optional pipeline (docs/AUDIO.md) — a fresh
  // self-hosted instance has stories but no audio until someone runs it by
  // hand. A blanket "with karaoke audio" tagline reads as a broken promise
  // in that state, so only claim it once at least one story actually has it.
  const hasAnyAudio = texts.some((t) => t.audio !== null);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Read</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Graded Chinese stories
        {hasAnyAudio ? " with karaoke audio" : ""} and a tap dictionary.
      </p>

      {texts.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center">
          <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No stories yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Running locally? Run{" "}
            <code className="rounded bg-muted px-1 py-0.5">npx tsx scripts/ingest-story.ts --all --force</code>{" "}
            to add stories.
          </p>
        </div>
      ) : (
        <>
          {/* Continue reading row */}
          {continueStory && (
            <Link
              href={`/reading/${continueStory.slug}/read`}
              className="mb-6 flex items-center justify-between rounded-xl border-2 border-primary/20 bg-primary/5 px-5 py-4 transition-colors hover:bg-primary/10"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-primary mb-0.5">Continue reading</div>
                <div className="text-sm font-semibold truncate">{continueStory.titleEn ?? continueStory.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${continueProgress?.lastPosition ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{continueProgress?.lastPosition ?? 0}%</span>
                </div>
              </div>
              <ChevronRight className="size-5 text-primary shrink-0 ml-2" />
            </Link>
          )}

          {/* Best-fit recommendation — hidden once it's already the continue-reading story */}
          {bestFitText && bestFitText.id !== continueStory?.id && (
            <Link
              href={`/reading/${bestFitText.slug}`}
              className="mb-6 flex items-center justify-between rounded-xl border-2 border-amber/30 bg-amber/5 px-5 py-4 transition-colors hover:bg-amber/10"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-amber">
                  <Sparkles className="size-3.5" /> Best next read
                </div>
                <div className="text-sm font-semibold truncate">{bestFitText.titleEn ?? bestFitText.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  HSK {bestFitText.level} · you know {Math.round((coverageByText.get(bestFitText.id)?.pct ?? 0) * 100)}% of its words
                </div>
              </div>
              <ChevronRight className="size-5 text-amber shrink-0 ml-2" />
            </Link>
          )}

          <div className="space-y-8">
            {levels.map((level) => (
              <section key={level}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  HSK {level}
                </h2>
                <div className="space-y-2">
                  {texts
                    .filter((t) => t.level === level)
                    .map((t) => {
                      const p = progressMap.get(t.id);
                      const isRead = !!p?.completedAt;
                      const coverage = coverageByText.get(t.id);
                      const fitClassName = coverage?.pct !== null && coverage?.pct !== undefined ? FIT_STYLE[fitLabel(coverage.pct)] : null;
                      return (
                        <Link
                          key={t.id}
                          href={`/reading/${t.slug}`}
                          className="group flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium group-hover:text-primary">
                              {t.titleEn ?? t.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {t.topicEn ?? t.topic}
                              {t.titleEn && ` · ${t.title}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {isRead && (
                              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">Read</span>
                            )}
                            {!isRead && fitClassName && coverage?.pct !== null && coverage?.pct !== undefined && (
                              <span
                                title={`You know ${coverage.knownCount} of ${coverage.totalCount} words in this story`}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${fitClassName}`}
                              >
                                {Math.round(coverage.pct * 100)}% known
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {t.estimatedMin ?? "?"} min
                            </span>
                            {t.audio && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                audio
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
