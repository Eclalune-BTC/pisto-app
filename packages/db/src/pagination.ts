import { calendarLocalDateSchema } from "@pisto/contracts";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** Lossless UTC cursor value; display timestamps can still use JavaScript Date. */
export function exactCursorTimestamp(column: AnyPgColumn) {
  return sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'`;
}

export const cursorTimestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?\+00$/;

/** Validate before a PostgreSQL cast without rounding the microsecond boundary. */
export function isCursorTimestamp(value: string): boolean {
  if (!cursorTimestampPattern.test(value)) return false;
  return (
    value.slice(0, 4) !== "0000" &&
    calendarLocalDateSchema.safeParse(value.slice(0, 10)).success &&
    /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value.slice(11, 19))
  );
}
