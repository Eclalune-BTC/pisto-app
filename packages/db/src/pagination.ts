import { calendarLocalDateSchema, uuidSchema } from "@pisto/contracts";
import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";

import { ProductError } from "./errors.ts";
import { fingerprintValue } from "./operation-log.ts";

/**
 * Every history list pages newest first by `(created_at, id)`. The cursor is an
 * opaque base64url JSON payload bound to the list kind and filters that produced it,
 * because replaying it under other filters would silently skip or repeat rows.
 */
export interface KeysetCursor {
  createdAt: string;
  id: string;
}

const cursorTimestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?\+00$/;

/** Lossless UTC cursor value; display timestamps can still use JavaScript Date. */
export function exactCursorTimestamp(column: AnyPgColumn) {
  return sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'`;
}

/** Validate before a PostgreSQL cast without rounding the microsecond boundary. */
export function isCursorTimestamp(value: string): boolean {
  if (!cursorTimestampPattern.test(value)) return false;
  return (
    calendarLocalDateSchema.safeParse(value.slice(0, 10)).success &&
    /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value.slice(11, 19))
  );
}

const cursorPayloadSchema = z.object({
  createdAt: z.string().refine(isCursorTimestamp),
  filterFingerprint: z.string(),
  id: uuidSchema,
  version: z.literal(1),
});

/** Keys are sorted so the canonical JSON, and therefore the fingerprint, is stable. */
export function listFilterFingerprint(
  kind: string,
  filters: Record<string, string | boolean | null>,
): Promise<string> {
  const canonical = Object.fromEntries(
    Object.entries({ ...filters, kind, version: 1 }).sort(([left], [right]) =>
      left < right ? -1 : 1,
    ),
  );
  return fingerprintValue(canonical);
}

export function encodeCursor(cursor: KeysetCursor, filterFingerprint: string): string {
  const payload = { createdAt: cursor.createdAt, filterFingerprint, id: cursor.id, version: 1 };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(
  value: string | undefined,
  filterFingerprint: string,
): KeysetCursor | null {
  if (value === undefined) return null;
  const invalid = () =>
    new ProductError("VALIDATION_ERROR", "The page cursor is invalid for this query");
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw invalid();
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw invalid();
    throw error;
  }
  const parsed = cursorPayloadSchema.safeParse(json);
  if (!parsed.success || parsed.data.filterFingerprint !== filterFingerprint) throw invalid();
  return { createdAt: parsed.data.createdAt, id: parsed.data.id };
}

/**
 * Rows strictly after the cursor in `(created_at desc, id desc)` order. The row-value
 * comparison lets PostgreSQL seek a `(…, created_at, id)` index; the timestamp is cast
 * from exact text because a JavaScript Date drops PostgreSQL's microseconds.
 */
export function keysetBefore(
  columns: { createdAt: AnyPgColumn; id: AnyPgColumn },
  cursor: KeysetCursor | null,
): SQL | undefined {
  if (!cursor) return undefined;
  return sql`(${columns.createdAt}, ${columns.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::${sql.raw(columns.id.getSQLType())})`;
}

export function pageRows<T extends { createdAtExact: string; id: string }>(
  rows: T[],
  limit: number,
  filterFingerprint: string,
): { rows: T[]; nextCursor: string | null } {
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    rows: page,
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ createdAt: last.createdAtExact, id: last.id }, filterFingerprint)
        : null,
  };
}
