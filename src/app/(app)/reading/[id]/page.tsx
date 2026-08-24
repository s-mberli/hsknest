import { Headphones } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { KeywordChip } from "@/components/reading/KeywordChip";

interface TokenData { w: string; py: string | null; lvl: number | null; isPunct: boolean; senses: { pinyin: string; meanings: string[] }[] | null; }

export default async function ReadingOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const { id } = await params;
  const text = await prisma.readingText.findFirst({ where: { slug: id, status: "published" }, include: { audio: true } });
  if (!text) notFound();

  const doc = text.bodyHydrated as { tokens?: TokenData[] } | null;
  const keywords: { word: string; py: string | null; lvl: number | null; senses: { pinyin: string; meanings: string[] }[] | null }[] = [];
  if (doc?.tokens) {
    const seen = new Set<string>();
    for (const tk of doc.tokens) {
      if (tk.isPunct || tk.lvl !== text.level || seen.has(tk.w) || keywords.length >= 12) continue;
      seen.add(tk.w);
      keywords.push({ word: tk.w, py: tk.py, lvl: tk.lvl, senses: tk.senses });
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{text.titleEn ?? text.title}</h1>
      {text.titleEn && <p className="text-sm text-muted-foreground mb-4">{text.title}</p>}
      <p className="text-sm text-muted-foreground mb-1">HSK {text.level} · {text.topicEn ?? text.topic}</p>
      {text.estimatedMin && <p className="text-xs text-muted-foreground mb-4">~{text.estimatedMin} min read</p>}

      <Link href={`/reading/${text.slug}/read`}
        className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors mb-6">
        <Headphones className="size-4" /> Read &amp; Listen
      </Link>

      {keywords.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Keywords</h2>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map(k => <KeywordChip key={k.word} word={k.word} py={k.py} lvl={k.lvl} senses={k.senses} />)}
          </div>
        </div>
      )}

      <Link href="/reading" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">← All stories</Link>
    </main>
  );
}
