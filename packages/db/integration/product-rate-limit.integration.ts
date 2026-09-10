import { afterAll, describe, expect, test } from "bun:test";
import { eq, inArray, sql } from "drizzle-orm";
import { createDatabase } from "../src/client.ts";
import { parseDatabaseConfig } from "../src/env.ts";
import { createProductRateLimiter } from "../src/product-rate-limit.ts";
import { rateLimit } from "../src/schema/auth.ts";

const config = parseDatabaseConfig(process.env);
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(config.url).hostname)) {
  throw new Error("Product limiter integration tests require local PostgreSQL");
}
const database = createDatabase({ ...config, maxConnections: 8 });
const userId = `limiter-test-${crypto.randomUUID()}`;
const keys = [`pisto:product:read:${userId}`, `pisto:product:write:${userId}`];
const policy = { readLimit: 5, writeLimit: 2, windowSeconds: 60 };

afterAll(async () => {
  await database.db.delete(rateLimit).where(inArray(rateLimit.key, keys));
  await database.close();
});

describe("shared product limiter", () => {
  test("rejects windows that conflict with auth table cleanup", () => {
    expect(() => createProductRateLimiter(database.db, { ...policy, windowSeconds: 120 })).toThrow(
      "60 seconds",
    );
  });

  test("two API replicas share one exact concurrent budget", async () => {
    const first = createProductRateLimiter(database.db, policy);
    const second = createProductRateLimiter(database.db, policy);
    const results = await Promise.all(
      Array.from({ length: 16 }, (_, i) => (i % 2 ? first : second)({ userId, write: false })),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(
      results.every((result) => result.retryAfterSeconds > 0 && result.retryAfterSeconds <= 60),
    ).toBe(true);
    const rows = await database.db.select().from(rateLimit).where(inArray(rateLimit.key, keys));
    expect(rows[0]?.count).toBe(6);
  });

  test("separates write budget and resets expired windows with the database clock", async () => {
    const consume = createProductRateLimiter(database.db, policy);
    expect((await consume({ userId, write: true })).allowed).toBe(true);
    expect((await consume({ userId, write: true })).allowed).toBe(true);
    expect((await consume({ userId, write: true })).allowed).toBe(false);
    await database.db
      .update(rateLimit)
      .set({ lastRequest: sql`last_request - 61000` })
      .where(inArray(rateLimit.key, keys));
    expect((await consume({ userId, write: true })).allowed).toBe(true);
    expect((await consume({ userId, write: false })).allowed).toBe(true);
  });

  test("measures retry delay after waiting behind a newer window timestamp", async () => {
    const actorId = `limiter-order-test-${crypto.randomUUID()}`;
    const key = `pisto:product:read:${actorId}`;
    const consume = createProductRateLimiter(database.db, policy);
    let waiting: ReturnType<typeof consume> | undefined;

    try {
      await consume({ userId: actorId, write: false });
      await database.db.transaction(async (tx) => {
        const [holder] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        if (!holder) throw new Error("Lock holder backend was not found");
        await tx.select().from(rateLimit).where(eq(rateLimit.key, key)).for("update");
        waiting = consume({ userId: actorId, write: false });

        let blocked = false;
        const deadline = performance.now() + 2_000;
        while (performance.now() < deadline) {
          await tx.execute(sql`select pg_stat_clear_snapshot()`);
          const [state] = await tx.execute<{ blocked: boolean }>(sql`
            select exists (
              select 1 from pg_stat_activity
              where ${holder.pid} = any(pg_blocking_pids(pid))
            ) as blocked
          `);
          if (state?.blocked) {
            blocked = true;
            break;
          }
          await Bun.sleep(10);
        }
        expect(blocked).toBe(true);

        // Reproduce a later request establishing the window before the waiter resumes.
        await tx.execute(sql`select pg_sleep(0.01)`);
        await tx
          .update(rateLimit)
          .set({ lastRequest: sql`floor(extract(epoch from clock_timestamp()) * 1000)::bigint` })
          .where(eq(rateLimit.key, key));
      });

      if (!waiting) throw new Error("The waiting request was not started");
      const result = await waiting;
      expect(result.allowed).toBe(true);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(policy.windowSeconds);
      const [record] = await database.db.select().from(rateLimit).where(eq(rateLimit.key, key));
      expect(record?.count).toBe(2);
    } finally {
      if (waiting) await Promise.allSettled([waiting]);
      await database.db.delete(rateLimit).where(eq(rateLimit.key, key));
    }
  });
});
