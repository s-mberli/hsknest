import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { resolveStoryAudio, timingsMatchText } from "@/lib/reading/storyAudio";
import { ReaderView } from "@/components/reading/ReaderView";

export default async function ReadingReadPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const { id } = await params;
  const text = await prisma.readingText.findFirst({ where: { slug: id, status: "published" } });
  if (!text) notFound();

  const progress = await prisma.readingProgress.findUnique({ where: { userId_textId: { userId, textId: text.id } } });
  const initialScrollPct = progress?.lastPosition ?? 0;

  // Audio availability is derived from the filesystem, never from a DB row —
  // see src/lib/reading/storyAudio.ts. With no audio base URL configured there
  // is nothing to serve the mp3 from, so skip the lookup entirely (matches
  // src/lib/audio.ts, where an unset base URL disables generated clips).
  const audio = process.env.NEXT_PUBLIC_AUDIO_BASE_URL ? resolveStoryAudio(text.slug) : null;
  // Timings generated against an older revision of the body would silently
  // desync the karaoke highlight. Degrade rather than refuse: keep the
  // narration playable, just drop the word-level highlighting.
  const timings = audio && timingsMatchText(audio.timings, text.bodyRaw) ? audio.timings : null;

  const hydrated = text.bodyHydrated as Record<string, unknown> | null;
  return <ReaderView
    textId={text.id} slug={text.slug} title={text.title} titleEn={text.titleEn} level={text.level}
    topic={text.topic} topicEn={text.topicEn} hydrated={hydrated} audioUrl={audio?.audioUrl ?? null}
    timings={timings} estimatedMin={text.estimatedMin} languageId={text.languageId}
    initialScrollPct={initialScrollPct}
  />;
}
