/** Up to two uppercase initials for an avatar, e.g. "Tienda Luna" → "TL", "Pisto" → "PI". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const first = words[0];
  if (!first) throw new Error("An avatar needs a non-empty display name.");
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const letters = last
    ? [...first].slice(0, 1).concat([...last].slice(0, 1))
    : [...first].slice(0, 2);
  return letters.join("").toLocaleUpperCase("es");
}
