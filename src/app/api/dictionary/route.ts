import { NextResponse } from "next/server";

import { lookupChinese } from "@/lib/dictionary";
import { getCurrentUserId } from "@/lib/session";
import { dictionaryQuerySchema } from "@/lib/validation";

/**
 * Word-entry suggestions from the bundled CC-CEDICT data. Currently Chinese
 * only; other languages return an empty list so the client needs no special
 * casing.
 */
export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
