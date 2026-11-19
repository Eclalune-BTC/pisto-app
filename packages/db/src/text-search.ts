import { or, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const accented = "áàäâãéèëêíìïîóòöôõúùüûñç";
const plain = "aaaaaeeeeiiiiooooouuuunc";

export function containsName(column: AnyPgColumn, search: string): SQL {
  const term = search.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  return sql`translate(lower(${column}), ${accented}, ${plain}) like ${pattern} escape '\\'`;
}

/**
 * Case-insensitive substring match over any of the columns. PostgreSQL treats % and
 * _ as wildcards inside ILIKE, so an unescaped search of "%" would match every row.
 */
export function containsText(columns: readonly AnyPgColumn[], search: string): SQL | undefined {
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  return or(...columns.map((column) => sql`${column} ilike ${pattern} escape '\\'`));
}
