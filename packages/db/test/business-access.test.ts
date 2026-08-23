import { describe, expect, test } from "bun:test";
import {
  authorizeBusinessAction,
  type BusinessDatabaseExecutor,
  type BusinessLockStrength,
} from "../src/business-access.ts";
import { ProductError } from "../src/product-core.ts";

const actor = {
  userId: "user-test",
  sessionId: "session-test",
  activeBusinessId: "business-test",
};

type FakeQuery = Promise<unknown[]> & {
  from: () => FakeQuery;
  innerJoin: () => FakeQuery;
  where: () => FakeQuery;
  limit: () => FakeQuery;
  for: (lock: string) => Promise<unknown[]>;
};

function accessRow(role: string) {
  return {
    businessId: "business-test",
    currency: "USD",
    currencyMinorUnitDigits: 2,
    queriedAt: new Date("2026-08-23T12:00:00.000Z"),
    role,
    timeZone: "America/El_Salvador",
  };
}

function recordingExecutor(role: string) {
  const locks: string[] = [];
  const results: unknown[][] = [[{ id: "session-test" }], [accessRow(role)]];
  let queryIndex = 0;

  const builder = (rows: unknown[]): FakeQuery => {
    const query = Promise.resolve(rows) as FakeQuery;
    query.from = () => query;
    query.innerJoin = () => query;
    query.where = () => query;
    query.limit = () => query;
    query.for = (lock: string) => {
      locks.push(lock);
      return Promise.resolve(rows);
    };
    return query;
  };

  const executor = {
    select: () => builder(results[queryIndex++] ?? []),
  } as unknown as BusinessDatabaseExecutor;
  return { executor, locks };
}

async function authorizeWith(role: string, lock: BusinessLockStrength) {
  const { executor, locks } = recordingExecutor(role);
  const access = await authorizeBusinessAction(executor, actor, ["reports:read"], lock);
  return { access, locks };
}

describe("business action authorization locks", () => {
  test("takes no row lock when the caller asks for none", async () => {
    const { access, locks } = await authorizeWith("owner", "none");

    expect(locks).toEqual([]);
    expect(access.role).toBe("owner");
    expect(access.timeZone).toBe("America/El_Salvador");
  });

  test("keeps the share lock as the unchanged default", async () => {
    const explicit = await authorizeWith("owner", "share");
    const { executor, locks } = recordingExecutor("owner");
    await authorizeBusinessAction(executor, actor, ["reports:read"]);

    expect(explicit.locks).toEqual(["share", "share"]);
    expect(locks).toEqual(["share", "share"]);
  });

  test("keeps applying the update lock to both authorization reads", async () => {
    const { locks } = await authorizeWith("owner", "update");

    expect(locks).toEqual(["update", "update"]);
  });

  test("enforces the permission set even when no row lock is taken", async () => {
    const { executor } = recordingExecutor("member");

    await expect(
      authorizeBusinessAction(executor, actor, ["reports:read"], "none"),
    ).rejects.toBeInstanceOf(ProductError);
  });

  test("rejects an actor without an active business before querying", async () => {
    const { executor, locks } = recordingExecutor("owner");

    await expect(
      authorizeBusinessAction(
        executor,
        { ...actor, activeBusinessId: null },
        ["reports:read"],
        "none",
      ),
    ).rejects.toMatchObject({ code: "BUSINESS_REQUIRED" });
    expect(locks).toEqual([]);
  });
});
