import { sql } from "drizzle-orm";
import type { Database } from "./client.ts";

export interface ProductRateLimitPolicy {
  readLimit: number;
  writeLimit: number;
  windowSeconds: number;
}

export type ConsumeProductRequest = (input: {
  userId: string;
  write: boolean;
}) => Promise<{ allowed: boolean; retryAfterSeconds: number }>;

/** Reuse the operational limiter table with a namespace separate from auth keys. */
export function createProductRateLimiter(
  db: Database,
  policy: ProductRateLimitPolicy,
): ConsumeProductRequest {
  // Better Auth prunes this shared table after its longest (60-second) window.
  // A longer product window would be silently reset by that independent cleanup.
  if (policy.windowSeconds !== 60) {
    throw new Error("The shared product rate limit window must be 60 seconds");
  }
  return async ({ userId, write }) => {
    const key = `pisto:product:${write ? "write" : "read"}:${userId}`;
    const limit = write ? policy.writeLimit : policy.readLimit;
    const windowMs = policy.windowSeconds * 1_000;
    // A single atomic upsert shares the budget across replicas. PostgreSQL's
    // clock owns the window; denied traffic cannot overflow the counter.
    const rows = await db.execute<{
      count: number;
      retry_after: string;
    }>(sql`
      with clock as (
        select floor(extract(epoch from statement_timestamp()) * 1000)::bigint as now_ms
      ), consumed as (
        insert into "rateLimit" (id, key, count, last_request)
        select ${crypto.randomUUID()}, ${key}, 1, now_ms from clock
        on conflict (key) do update set
          count = case
            when "rateLimit".last_request + ${windowMs} <= (select now_ms from clock) then 1
            else least("rateLimit".count + 1, ${limit + 1}) end,
          last_request = case
            when "rateLimit".last_request + ${windowMs} <= (select now_ms from clock)
              then (select now_ms from clock)
            else "rateLimit".last_request end
        returning count, last_request
      )
      select count,
        greatest(1, ceil((last_request + ${windowMs} - clock.now_ms) / 1000.0))::text as retry_after
      from consumed cross join clock
    `);
    const row = rows[0];
    if (!row) throw new Error("Product rate limit result is missing");
    return { allowed: row.count <= limit, retryAfterSeconds: Number(row.retry_after) };
  };
}
