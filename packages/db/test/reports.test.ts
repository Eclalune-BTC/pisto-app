import { describe, expect, test } from "bun:test";
import type { Database } from "../src/client.ts";
import { ProductError } from "../src/product-core.ts";
import { createReportsRepository, REPORT_TRANSACTION_CONFIG } from "../src/reports.ts";

const actor = {
  userId: "user-test",
  sessionId: "session-test",
  activeBusinessId: "business-test",
};

const validRange = { startLocalDate: "2026-08-01", endLocalDate: "2026-08-22" };

type FakeQuery = Promise<unknown[]> & {
  from: () => FakeQuery;
  innerJoin: () => FakeQuery;
  where: () => FakeQuery;
  limit: () => FakeQuery;
  for: (lock: string) => Promise<unknown[]>;
};

function snapshotDatabase() {
  const locks: string[] = [];
  let executeCalls = 0;

  const query = Promise.resolve([] as unknown[]) as FakeQuery;
  query.from = () => query;
  query.innerJoin = () => query;
  query.where = () => query;
  query.limit = () => query;
  query.for = (lock: string) => {
    locks.push(lock);
    return Promise.resolve([]);
  };

  const transaction = {
    select: () => query,
    execute: () => {
      executeCalls += 1;
      return Promise.resolve([]);
    },
  };

  const db = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction),
  } as unknown as Database;

  return { db, locks, executeCalls: () => executeCalls };
}

describe("operating reports repository boundary", () => {
  test("rejects an invalid date range before opening a database transaction", async () => {
    let transactionCalled = false;
    const repository = createReportsRepository({
      transaction: async () => {
        transactionCalled = true;
        throw new Error("Transaction must not run");
      },
    } as unknown as Database);

    await expect(
      repository.getOperatingReport(actor, {
        startLocalDate: "2026-08-31",
        endLocalDate: "2026-08-01",
      }),
    ).rejects.toBeInstanceOf(ProductError);
    expect(transactionCalled).toBe(false);
  });

  test("requests a read-only repeatable-read snapshot and preserves query failures", async () => {
    const queryFailure = new Error("query failed");
    let transactionConfig: unknown;
    const repository = createReportsRepository({
      transaction: async (_callback: unknown, config: unknown) => {
        transactionConfig = config;
        throw queryFailure;
      },
    } as unknown as Database);

    await expect(repository.getOperatingReport(actor, validRange)).rejects.toBe(queryFailure);
    expect(transactionConfig).toEqual(REPORT_TRANSACTION_CONFIG);
    expect(REPORT_TRANSACTION_CONFIG).toEqual({
      accessMode: "read only",
      isolationLevel: "repeatable read",
    });
  });

  test("authorizes without a row lock before any report query runs", async () => {
    const { db, locks, executeCalls } = snapshotDatabase();
    const repository = createReportsRepository(db);

    await expect(repository.getOperatingReport(actor, validRange)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(locks).toEqual([]);
    expect(executeCalls()).toBe(0);
  });
});
