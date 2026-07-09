import { NextResponse } from "next/server";

import { requireUser } from "@/lib/apiRoute";
import { lookupChinese } from "@/lib/dictionary";
import { dictionaryQuerySchema } from "@/lib/validation";

/**
 * Word-entry suggestions from the bundled CC-CEDICT data. Currently Chinese
 * only; other languages return an empty list so the client needs no special
 * casing.
 */
export async function GET(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const { searchParams } = new URL(req.url);
  const parsed = dictionaryQuerySchema.safeParse({
    term: searchParams.get("term") ?? "",
    languageCode: searchParams.get("languageCode") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ suggestions: [] });
  }

  const { term, languageCode } = parsed.data;
  const isChinese = languageCode === "zh" || languageCode.startsWith("zh-");
  const suggestions = isChinese ? lookupChinese(term).slice(0, 3) : [];

  return NextResponse.json({ suggestions });
}
