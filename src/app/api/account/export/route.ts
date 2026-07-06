import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/** Escape a value for RFC-4180 CSV (quote if it contains comma, quote, or newline). */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const HEADERS = [
  "term",
  "translation",
  "phonetic",
  "language",
  "state",
  "intervalDays",
  "easeFactor",
  "lapses",
  "dueAt",
];

/** Download the user's full progress as a CSV file. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rows = await prisma.userProgress.findMany({
    where: { userId },
    include: {
      word: { include: { wordList: { include: { language: true } } } },
    },
    orderBy: { dueAt: "asc" },
  });

  const lines = [HEADERS.join(",")];
  for (const p of rows) {
    lines.push(
      [
        p.word.term,
        p.word.translation,
        p.word.phonetic ?? "",
        p.word.wordList.language.name,
        p.state,
        p.intervalDays,
        p.easeFactor,
        p.lapses,
        p.dueAt.toISOString(),
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const csv = lines.join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="progress-export.csv"',
    },
  });
}
