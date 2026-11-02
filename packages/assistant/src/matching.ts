import { nameWords, sameWord } from "./text.ts";

export type NameMatch<T> =
  | { kind: "none" }
  | { kind: "matched"; record: T; exact: boolean }
  /** Several records resemble the name equally; the user must choose. */
  | { kind: "ambiguous" };

function score(heardWords: readonly string[], candidateName: string): number {
  const words = nameWords(candidateName);
  if (words.length === 0) return 0;
  if (
    words.length === heardWords.length &&
    words.every((word, i) => sameWord(word, heardWords[i] as string))
  ) {
    return 3;
  }
  const shared = heardWords.filter((heard) => words.some((word) => sameWord(heard, word))).length;
  if (shared === heardWords.length) return 2;
  return shared > 0 && shared * 2 >= heardWords.length ? 1 : 0;
}

/**
 * Picks the record a heard name refers to. Only an equal name (ignoring case, accents, plurals and
 * courtesy titles) is exact; a unique partial match is returned for the user to confirm; ties
 * are ambiguous rather than resolved by list order.
 */
export function matchName<T extends { name: string }>(
  heard: string | null,
  candidates: readonly T[],
): NameMatch<T> {
  if (heard === null) return { kind: "none" };
  const heardWords = nameWords(heard);
  if (heardWords.length === 0) return { kind: "none" };
  let best = 0;
  let winners: T[] = [];
  for (const candidate of candidates) {
    const value = score(heardWords, candidate.name);
    if (value === 0 || value < best) continue;
    if (value > best) {
      best = value;
      winners = [candidate];
    } else {
      winners.push(candidate);
    }
  }
  if (best === 0) return { kind: "none" };
  const [record, other] = winners;
  if (!record || other) return { kind: "ambiguous" };
  return { kind: "matched", record, exact: best === 3 };
}
