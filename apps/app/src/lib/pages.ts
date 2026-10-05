/** The records of every loaded page of an infinite query, in server order. */
export function flattenPages<T>(
  data: { pages: readonly { items: readonly T[] }[] } | undefined,
): T[] {
  return data?.pages.flatMap(({ items }) => items) ?? [];
}
