export function directProgressCount(wordIds: string[], progressWordIds: Iterable<string>): number {
  const direct = new Set(progressWordIds);
  return wordIds.filter((id) => direct.has(id)).length;
}
