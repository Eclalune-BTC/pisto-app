import { afterAll, describe, expect, test } from "bun:test";
import { inArray, sql } from "drizzle-orm";
import { createDatabase } from "../src/client.ts";
import { parseDatabaseConfig } from "../src/env.ts";
import { createProductRateLimiter } from "../src/product-rate-limit.ts";
import { rateLimit } from "../src/schema/auth.ts";

const database = createDatabase({ ...parseDatabaseConfig(process.env), maxConnections: 8 });
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
});
