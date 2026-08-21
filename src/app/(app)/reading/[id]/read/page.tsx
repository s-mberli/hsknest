import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { ReaderView } from "@/components/reading/ReaderView";

export default async function ReadingReadPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const { id } = await params;
  const text = await prisma.readingText.findFirst({ where: { slug: id, status: "published" }, include: { audio: true } });
  if (!text) notFound();

  const progress = await prisma.readingProgress.findUnique({ where: { userId_textId: { userId, textId: text.id } } });
  const initialScrollPct = progress?.lastPosition ?? 0;

  const hydrated = text.bodyHydrated as Record<string, unknown> | null;
  return <ReaderView
    textId={text.id} slug={text.slug} title={text.title} titleEn={text.titleEn} level={text.level}
    topic={text.topic} topicEn={text.topicEn} hydrated={hydrated} audioUrl={text.audio?.audioUrl ?? null}
    timingsUrl={text.audio?.timingsUrl ?? null} estimatedMin={text.estimatedMin} languageId={text.languageId}
    initialScrollPct={initialScrollPct}
  />;
}
