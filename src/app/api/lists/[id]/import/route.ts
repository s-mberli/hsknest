import { NextResponse } from "next/server";

import { parseBody, requireUser } from "@/lib/apiRoute";
import { prisma } from "@/lib/prisma";
import { parseDelimited } from "@/lib/import";
import { rateLimit } from "@/lib/rateLimit";
import { importSchema } from "@/lib/validation";

const MAX_ROWS = 2000;

/**
 * Parse pasted/CSV text into words for an owned list. Skips blank/duplicate
 * terms (both within the paste and against words already in the list), caps at
 * 2000 added rows. → { added, skipped }.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  // Imports are heavy (up to 2000 rows each): 20/hour is generous for a
  // human and a wall for a script hammering the DB.
  if (!rateLimit(`import:${userId}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const { id } = await params;

  const parsed = await parseBody(req, importSchema);
  if (parsed instanceof NextResponse) return parsed;

  const list = await prisma.wordList.findUnique({
    where: { id },
    select: { createdById: true },
  });
  if (!list || list.createdById !== userId) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const {
    words,
    skipped: parseSkipped,
    skippedNoTerm,
    skippedDuplicate,
  } = parseDelimited(parsed.text, {
    delimiter: parsed.delimiter,
    columns: parsed.columns,
  });

  // Drop terms that already exist in the list (case-insensitive).
  const existing = await prisma.word.findMany({
    where: { wordListId: id },
    select: { term: true },
  });
  const existingTerms = new Set(existing.map((w) => w.term.toLowerCase()));

  let skipped = parseSkipped;
  let skippedAlreadyInList = 0;
  let skippedOverCap = 0;
  const toAdd: typeof words = [];
  for (const w of words) {
    if (existingTerms.has(w.term.toLowerCase())) {
      skipped += 1;
      skippedAlreadyInList += 1;
      continue;
    }
    if (toAdd.length >= MAX_ROWS) {
      skipped += 1;
      skippedOverCap += 1;
      continue;
    }
    // A word needs a translation; treat term-only imports as needing a blank.
    toAdd.push(w);
  }

  let added = 0;
  if (toAdd.length > 0) {
    const last = await prisma.word.findFirst({
      where: { wordListId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const basePosition = (last?.position ?? -1) + 1;

    const result = await prisma.word.createMany({
      data: toAdd.map((w, i) => ({
        wordListId: id,
        term: w.term,
        translation: w.translation,
        phonetic: w.phonetic,
        ...(w.meanings && w.meanings.length > 0
          ? { metadata: { meanings: w.meanings.map((gloss) => ({ gloss })) } }
          : {}),
        position: basePosition + i,
      })),
    });
    added = result.count;
  }

  return NextResponse.json({
    added,
    skipped,
    reasons: {
      noTerm: skippedNoTerm,
      duplicateInPaste: skippedDuplicate,
      alreadyInList: skippedAlreadyInList,
      overCap: skippedOverCap,
    },
  });
}
