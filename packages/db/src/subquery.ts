import { type SQL, sql } from "drizzle-orm";

/**
 * Drizzle renders top-level columns of a single-table projection without their table
 * name, which would bind a correlated subquery's outer reference to the inner table
 * and silently match nothing. Columns inside a nested fragment keep their table.
 */
export function correlatedSubquery<T>(fragment: SQL): SQL<T> {
  return sql<T>`${fragment}`;
}
