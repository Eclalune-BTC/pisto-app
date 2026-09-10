import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** Lossless UTC cursor value; display timestamps can still use JavaScript Date. */
export function exactCursorTimestamp(column: AnyPgColumn) {
  return sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'`;
}

export const cursorTimestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?\+00$/;
