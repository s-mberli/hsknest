/** Move a lone tail into the preceding round rather than dropping a target. */
export function matchRounds<T>(cards: T[], size = 5): T[][] {
  if (cards.length < 2) return [];
  const rounds: T[][] = [];
  for (let i = 0; i < cards.length; i += size) rounds.push(cards.slice(i, i + size));
  if (rounds.length > 1 && rounds.at(-1)!.length === 1) {
    rounds.at(-2)!.push(...rounds.pop()!);
  }
  return rounds;
}
