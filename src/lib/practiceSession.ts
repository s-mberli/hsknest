export interface MissedWord {
  wordId: string;
  term: string;
  translation: string;
}

export function practiceSessionHref(
  pathname: string,
  current: URLSearchParams,
  sessionId: string,
  wordIds?: string[]
): string {
  const params = new URLSearchParams();
  for (const name of ["listIds", "languageId"]) {
    const value = current.get(name);
    if (value) params.set(name, value);
  }
  const ids = wordIds === undefined ? undefined : [...new Set(wordIds)];
  params.set("mode", "practice");
  params.set("limit", String(ids === undefined ? 20 : Math.max(1, ids.length)));
  if (ids !== undefined) params.set("wordIds", ids.join(","));
  params.set("session", sessionId);
  const route = pathname === "/study/match" && ids !== undefined && ids.length < 2
    ? "/study" : pathname;
  return `${route}?${params}`;
}
