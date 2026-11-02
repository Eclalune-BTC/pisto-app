/**
 * Lowercases and strips diacritics one UTF-16 unit at a time, so index `i` of the result always
 * corresponds to index `i` of the input. Spans located in the folded text are therefore valid
 * offsets into the original text.
 */
export function fold(text: string): string {
  let result = "";
  for (let index = 0; index < text.length; index += 1) {
    const unit = text[index] as string;
    const folded = unit.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    result += folded.length === 1 ? folded : unit;
  }
  return result;
}

// Courtesy titles, articles and connectors say nothing about which record was meant.
const ignoredNameWords = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "don",
  "dona",
  "el",
  "la",
  "las",
  "lo",
  "los",
  "mi",
  "nina",
  "nino",
  "para",
  "por",
  "senor",
  "senora",
  "senorita",
  "sr",
  "sra",
  "srta",
  "su",
  "un",
  "una",
  "y",
]);

/** Folded words of a name without titles or connectors. */
export function nameWords(name: string): string[] {
  return fold(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !ignoredNameWords.has(word));
}

/**
 * The word and its possible singulars. Folding loses the accent that tells "cafés" (café + s)
 * from "frijoles" (frijol + es), so both readings are kept.
 */
export function wordStems(word: string): string[] {
  const stems = [word];
  if (word.length > 3 && word.endsWith("s")) stems.push(word.slice(0, -1));
  if (word.length > 4 && word.endsWith("es")) stems.push(word.slice(0, -2));
  return stems;
}

/** True when two folded words can be the same word in singular or plural. */
export function sameWord(left: string, right: string): boolean {
  const stems = wordStems(right);
  return wordStems(left).some((stem) => stems.includes(stem));
}

/**
 * Terms for a folded substring search: the shortest stem of each word finds singular and plural,
 * and one-letter words would match almost every record.
 */
export function searchTerms(name: string): string[] {
  return nameWords(name)
    .map((word) => wordStems(word).at(-1) as string)
    .filter((term) => term.length >= 2);
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}]/u.test(character);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every whole-word occurrence of `fragment` in `text`, ignoring case, accents and the amount of
 * whitespace between words.
 */
export function findOccurrences(text: string, fragment: string): Array<[number, number]> {
  const words = fold(fragment).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const pattern = new RegExp(words.map(escapeRegExp).join("\\s+"), "gu");
  const folded = fold(text);
  const occurrences: Array<[number, number]> = [];
  for (const match of folded.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if (isWordCharacter(folded[start - 1]) || isWordCharacter(folded[end])) continue;
    occurrences.push([start, end]);
  }
  return occurrences;
}
