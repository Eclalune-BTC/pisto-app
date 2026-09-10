import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../src/business-access.ts";
import { createCashRepository } from "../src/cash.ts";
import { createCatalogRepository } from "../src/catalog.ts";
import { createDatabase, type Database } from "../src/client.ts";
import { parseDatabaseConfig } from "../src/env.ts";
import { createProductRepository } from "../src/product.ts";
import { createReceivablesRepository } from "../src/receivables.ts";
import { member, organization, session, user } from "../src/schema/auth.ts";
import { businessSettings } from "../src/schema/business.ts";
import {
  cashAccount,
  cashMovement,
  cashOperationReceipt,
  cashTransfer,
  expense,
} from "../src/schema/cash.ts";
import {
  catalogCategory,
  catalogOperation,
  catalogProduct,
  inventoryMovement,
} from "../src/schema/catalog.ts";
import {
  customer,
  receivable,
  receivableOperation,
  receivablePayment,
} from "../src/schema/receivables.ts";
import { sale, saleCorrection, saleOperation } from "../src/schema/sales.ts";

const database = createDatabase({ ...parseDatabaseConfig(process.env), maxConnections: 8 });
const product = createProductRepository(database.db);
const cash = createCashRepository(database.db);
const catalog = createCatalogRepository(database.db);
const receivables = createReceivablesRepository(database.db);
const runId = crypto.randomUUID();
const businessId = `hardening-business-${runId}`;
const ownerId = `hardening-owner-${runId}`;
const expiredUserId = `hardening-expired-${runId}`;
const ownerSessionId = `hardening-session-${runId}`;
const expiredSessionId = `hardening-expired-session-${runId}`;
const actor = { userId: ownerId, sessionId: ownerSessionId, activeBusinessId: businessId };
const key = () => crypto.randomUUID();

beforeAll(async () => {
  await database.db.insert(user).values(
    [ownerId, expiredUserId].map((id) => ({
      id,
      name: "Data hardening fixture",
      email: `${id}@example.test`,
      emailVerified: true,
    })),
  );
  await database.db
    .insert(organization)
    .values({ id: businessId, name: "Hardening Store", slug: businessId });
  await database.db.insert(businessSettings).values({
    businessId,
    currency: "USD",
    currencyMinorUnitDigits: 2,
    timeZone: "America/El_Salvador",
  });
  await database.db
    .insert(member)
    .values({ id: key(), organizationId: businessId, userId: ownerId, role: "owner" });
  await database.db.insert(session).values([
    {
      id: ownerSessionId,
      token: key(),
      userId: ownerId,
      activeOrganizationId: businessId,
      expiresAt: new Date(Date.now() + 600_000),
    },
    {
      id: expiredSessionId,
      token: key(),
      userId: expiredUserId,
      expiresAt: new Date(Date.now() - 60_000),
    },
  ]);
});

afterAll(async () => {
  for (const table of [
    saleOperation,
    saleCorrection,
    sale,
    catalogOperation,
    inventoryMovement,
    catalogProduct,
    catalogCategory,
    cashOperationReceipt,
    cashMovement,
    receivableOperation,
    receivablePayment,
    receivable,
    customer,
    cashTransfer,
    expense,
    cashAccount,
  ]) {
    await database.db.delete(table).where(eq(table.businessId, businessId));
  }
  await database.db.delete(businessSettings).where(eq(businessSettings.businessId, businessId));
  await database.db.delete(member).where(eq(member.organizationId, businessId));
  await database.db.delete(session).where(inArray(session.id, [ownerSessionId, expiredSessionId]));
  await database.db.delete(organization).where(eq(organization.id, businessId));
  await database.db.delete(user).where(inArray(user.id, [ownerId, expiredUserId]));
  await database.close();
});

/** Delay one real SQL boundary while another connection commits; no query is mocked. */
function beforeFirstExecute(
  db: Database,
  before: (tx: DatabaseTransaction) => Promise<void>,
): Database {
  return new Proxy(db, {
    get(target, property) {
      if (property !== "transaction") return Reflect.get(target, property);
      return (
        callback: (tx: DatabaseTransaction) => Promise<unknown>,
        config?: Parameters<Database["transaction"]>[1],
      ) =>
        target.transaction(async (tx) => {
          let intercepted = false;
          return callback(
            new Proxy(tx, {
              get(transaction, name) {
                if (name === "execute")
                  return async (query: Parameters<DatabaseTransaction["execute"]>[0]) => {
                    if (!intercepted) {
                      intercepted = true;
                      await before(tx);
                    }
                    return transaction.execute(query);
                  };
                const value = Reflect.get(transaction, name);
                return typeof value === "function" ? value.bind(transaction) : value;
              },
            }),
          );
        }, config);
    },
  });
}

async function collectIds<T>(
  list: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>,
  id: (item: T) => string,
) {
  const result: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list(cursor);
    result.push(...page.items.map(id));
    cursor = page.nextCursor ?? undefined;
    if (result.length > 100) throw new Error("Pagination did not terminate");
  } while (cursor);
  return result;
}

/** Both payment INSERTs must complete their FK checks before either cash lock. */
function synchronizePaymentInserts(db: Database): Database {
  let arrivals = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  return new Proxy(db, {
    get(target, property) {
      if (property !== "transaction") return Reflect.get(target, property);
      return (callback: (tx: DatabaseTransaction) => Promise<unknown>) =>
        target.transaction((tx) =>
          callback(
            new Proxy(tx, {
              get(transaction, name) {
                if (name !== "insert") {
                  const value = Reflect.get(transaction, name);
                  return typeof value === "function" ? value.bind(transaction) : value;
                }
                return (table: Parameters<DatabaseTransaction["insert"]>[0]) => {
                  const insert = transaction.insert(table);
                  if (table !== receivablePayment) return insert;
                  return new Proxy(insert, {
                    get(builder, method) {
                      if (method !== "values") return Reflect.get(builder, method);
                      return (values: Parameters<typeof builder.values>[0]) => {
                        const statement = builder.values(values);
                        return new Proxy(statement, {
                          get(query, operation) {
                            if (operation !== "returning") return Reflect.get(query, operation);
                            return async () => {
                              const rows = await query.returning();
                              if (++arrivals === 2) release();
                              await barrier;
                              return rows;
                            };
                          },
                        });
                      };
                    },
                  });
                };
              },
            }),
          ),
        );
    },
  });
}

/** Commit a correction after the first actual SELECT, before its result reaches the caller. */
function afterFirstSelect(db: Database, after: () => Promise<void>): Database {
  let intercepted = false;
  function wrap<T extends object>(builder: T): T {
    return new Proxy(builder, {
      get(target, property) {
        const value = Reflect.get(target, property);
        if (property === "then") {
          return (resolve: (rows: unknown) => unknown, reject: (error: unknown) => unknown) =>
            Promise.resolve(target)
              .then(async (rows) => {
                if (!intercepted) {
                  intercepted = true;
                  await after();
                }
                return rows;
              })
              .then(resolve, reject);
        }
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const result = value.apply(target, args);
          return result && typeof result === "object" ? wrap(result) : result;
        };
      },
    });
  }
  return new Proxy(db, {
    get(target, property) {
      if (property !== "select") return Reflect.get(target, property);
      return (...args: Parameters<Database["select"]>) => wrap(target.select(...args));
    },
  });
}

describe("data integrity regressions on PostgreSQL", () => {
  test("serializes payments and reversals on separate charges sharing one cash account", async () => {
    const account = await cash.createAccount(actor, {
      idempotencyKey: key(),
      name: "Concurrent payments",
      kind: "cash",
      currency: "USD",
      allowNegativeBalance: false,
      opening: null,
    });
    const contact = await receivables.createCustomer(actor, {
      idempotencyKey: key(),
      name: "Concurrent payer",
    });
    const charges = [];
    for (let index = 0; index < 2; index++) {
      charges.push(
        (
          await receivables.postReceivable(actor, {
            idempotencyKey: key(),
            customerId: contact.customer.id,
            description: "Concurrent charge",
            postedDate: "2026-09-10",
            originalMinorUnits: "100",
          })
        ).receivable,
      );
    }
    const concurrent = createReceivablesRepository(synchronizePaymentInserts(database.db));
    const payments = await Promise.all(
      charges.map((charge) =>
        concurrent.applyPayment(actor, charge.id, {
          idempotencyKey: key(),
          cashAccountId: account.account.id,
          amountMinorUnits: "10",
          occurredLocalDate: "2026-09-10",
          occurredLocalTime: "12:00",
        }),
      ),
    );
    expect(payments.map((payment) => payment.receivable.outstandingMinorUnits)).toEqual([
      "90",
      "90",
    ]);
    expect((await cash.getAccount(actor, account.account.id)).balanceMinorUnits).toBe("20");
    const reversing = createReceivablesRepository(synchronizePaymentInserts(database.db));
    const reversals = await Promise.all(
      payments.map((payment) =>
        reversing.reversePayment(actor, payment.payment.id, {
          idempotencyKey: key(),
          occurredLocalDate: "2026-09-10",
          occurredLocalTime: "12:01",
        }),
      ),
    );
    expect(reversals.map((reversal) => reversal.receivable.outstandingMinorUnits)).toEqual([
      "100",
      "100",
    ]);
    expect((await cash.getAccount(actor, account.account.id)).balanceMinorUnits).toBe("0");
  });

  test("reads sale status and correction from one snapshot and includes correction on posting replay", async () => {
    const command = {
      idempotencyKey: key(),
      grossMinorUnits: "100",
      occurredLocalDate: "2026-09-10",
      occurredLocalTime: "12:00",
    };
    const created = await product.createSale(actor, command);
    const reading = createProductRepository(
      afterFirstSelect(database.db, async () => {
        await product.voidSale(actor, created.sale.id, {
          idempotencyKey: key(),
          reason: "Concurrent correction",
        });
      }),
    );
    const before = await reading.getSale(actor, created.sale.id);
    expect(before.status).toBe("posted");
    expect(before.correction).toBeNull();
    const after = await product.getSale(actor, created.sale.id);
    expect(after.status).toBe("voided");
    expect(after.correction?.kind).toBe("void");
    const replay = await product.createSale(actor, command);
    expect(replay.replayed).toBe(true);
    expect(replay.sale).toEqual(after);
  });

  test("rejects expired onboarding and stale business discovery without creating a workspace", async () => {
    const expiredActor = {
      userId: expiredUserId,
      sessionId: expiredSessionId,
      activeBusinessId: null,
    };
    await expect(
      product.createBusiness(expiredActor, {
        name: "Expired session store",
        currency: "USD",
        timeZone: "America/El_Salvador",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(product.listBusinesses(expiredActor)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(product.listBusinesses({ ...actor, sessionId: key() })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    const rows = await database.db.select().from(member).where(eq(member.userId, expiredUserId));
    expect(rows).toHaveLength(0);

    await database.db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(session.id, ownerSessionId));
    try {
      await expect(
        product.createBusiness(actor, {
          name: "Hardening Store",
          currency: "USD",
          timeZone: "America/El_Salvador",
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(product.listBusinesses(actor)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    } finally {
      await database.db
        .update(session)
        .set({ expiresAt: new Date(Date.now() + 600_000) })
        .where(eq(session.id, ownerSessionId));
    }
  });

  test("serializes sales and cash sharing a command key without reversing lock order", async () => {
    const authorized = Promise.withResolvers<number>();
    const releaseCash = Promise.withResolvers<void>();
    const delayedCash = createCashRepository(
      beforeFirstExecute(database.db, async (tx) => {
        const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        if (!row) throw new Error("Missing backend identifier");
        authorized.resolve(row.pid);
        await releaseCash.promise;
      }),
    );
    const idempotencyKey = key();
    const cashWrite = delayedCash.createAccount(actor, {
      idempotencyKey,
      name: "Concurrent command account",
      kind: "cash",
      currency: "USD",
      allowNegativeBalance: false,
      opening: null,
    });
    const holderPid = await authorized.promise;
    const saleWrite = product.createSale(actor, {
      idempotencyKey,
      grossMinorUnits: "100",
      occurredLocalDate: "2026-08-01",
      occurredLocalTime: "10:00",
    });
    // Attach both rejection handlers before orchestrating the lock wait.
    const writes = Promise.allSettled([cashWrite, saleWrite]);
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const [row] = await database.db.execute<{ waiting: boolean }>(sql`
          select exists (select 1 from pg_stat_activity
            where ${holderPid} = any(pg_blocking_pids(pid))) as waiting
        `);
        if (row?.waiting) {
          blocked = true;
          break;
        }
        await Bun.sleep(10);
      }
      expect(blocked).toBe(true);
    } finally {
      releaseCash.resolve();
    }
    const results = await writes;
    expect(results.map(({ status }) => status)).toEqual(["fulfilled", "fulfilled"]);
  }, 10_000);

  test("pages cash accounts, expenses, and both transfer legs without losing microseconds", async () => {
    const accounts = [];
    for (let index = 0; index < 3; index += 1) {
      accounts.push(
        await cash.createAccount(actor, {
          idempotencyKey: key(),
          name: `Pagination cash ${index}`,
          kind: "cash",
          currency: "USD",
          allowNegativeBalance: true,
          opening: null,
        }),
      );
    }
    const firstId = accounts[0]?.account.id as string;
    const secondId = accounts[1]?.account.id as string;
    const transfer = await cash.transfer(actor, {
      idempotencyKey: key(),
      fromAccountId: firstId,
      toAccountId: secondId,
      amountMinorUnits: "10",
      currency: "USD",
      occurredLocalDate: "2026-08-01",
      occurredLocalTime: "10:00",
    });
    const expenses = [];
    for (let index = 0; index < 3; index += 1) {
      expenses.push(
        await cash.postExpense(actor, {
          idempotencyKey: key(),
          accountId: firstId,
          amountMinorUnits: "1",
          currency: "USD",
          category: "other",
          description: `Pagination expense ${index}`,
          occurredLocalDate: "2026-08-01",
          occurredLocalTime: "10:00",
        }),
      );
    }
    for (const table of [cashAccount, cashMovement, expense]) {
      await database.db
        .update(table)
        .set({ createdAt: sql`timestamptz '2026-08-01 10:00:00.123456+00'` })
        .where(eq(table.businessId, businessId));
    }
    const accountIds = await collectIds(
      (cursor) => cash.listAccounts(actor, { cursor, limit: 1, status: "all" }),
      ({ id }) => id,
    );
    const expenseIds = await collectIds(
      (cursor) => cash.listExpenses(actor, { cursor, limit: 1, status: "all" }),
      ({ id }) => id,
    );
    const movementIds = await collectIds(
      (cursor) => cash.listMovements(actor, { cursor, limit: 1 }),
      ({ id }) => id,
    );
    for (const { account } of accounts) expect(accountIds).toContain(account.id);
    for (const { expense: record } of expenses) expect(expenseIds).toContain(record.id);
    for (const movement of transfer.movements) expect(movementIds).toContain(movement.id);
    expect(new Set(movementIds).size).toBe(movementIds.length);
  });

  test("pages customers, categories, products, stock, and movement history exactly", async () => {
    const customerIds: string[] = [];
    const categoryIds: string[] = [];
    const productIds: string[] = [];
    const movementIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const contact = await receivables.createCustomer(actor, {
        idempotencyKey: key(),
        name: `Pagination contact ${index}`,
      });
      customerIds.push(contact.customer.id);
      const category = await catalog.createCategory(actor, {
        idempotencyKey: key(),
        name: `Pagination category ${index}`,
      });
      categoryIds.push(category.category.id);
      const item = await catalog.createProduct(actor, {
        idempotencyKey: key(),
        name: `Pagination product ${index}`,
        categoryId: category.category.id,
        sku: null,
        sellingPriceMinorUnits: null,
        unitKind: "unit",
        quantityPrecision: 0,
        tracked: true,
        lowStockThresholdMinorUnits: null,
      });
      productIds.push(item.product.id);
    }
    const firstProductId = productIds[0] as string;
    for (let index = 0; index < 3; index += 1) {
      const movement = await catalog.recordMovement(actor, firstProductId, {
        idempotencyKey: key(),
        action: "receive",
        quantityMinorUnits: "1",
        reason: "Pagination stock",
        occurredLocalDate: "2026-08-01",
        occurredLocalTime: "10:00",
      });
      movementIds.push(movement.movement.id);
    }
    for (const table of [customer, catalogCategory, catalogProduct, inventoryMovement]) {
      await database.db
        .update(table)
        .set({ createdAt: sql`timestamptz '2026-08-01 10:00:00.123456+00'` })
        .where(eq(table.businessId, businessId));
    }
    const contacts = await collectIds(
      (cursor) =>
        receivables.listCustomers(actor, {
          cursor,
          limit: 1,
          status: "all",
          query: "Pagination contact",
        }),
      ({ id }) => id,
    );
    const categories = await collectIds(
      (cursor) => catalog.listCategories(actor, { cursor, limit: 1, status: "all" }),
      ({ id }) => id,
    );
    const products = await collectIds(
      (cursor) => catalog.listProducts(actor, { cursor, limit: 1, status: "all" }),
      ({ product: record }) => record.id,
    );
    const stock = await collectIds(
      (cursor) => catalog.listStock(actor, { cursor, limit: 1, lowStockOnly: false }),
      ({ product: record }) => record.id,
    );
    const movements = await collectIds(
      (cursor) => catalog.listMovements(actor, firstProductId, { cursor, limit: 1 }),
      ({ id }) => id,
    );
    expect(contacts.sort()).toEqual(customerIds.sort());
    expect(categories.sort()).toEqual(categoryIds.sort());
    expect(products.sort()).toEqual(productIds.sort());
    expect(stock.sort()).toEqual(productIds.sort());
    expect(movements.sort()).toEqual(movementIds.sort());
  });

  test("keeps customer identity and balance in one snapshot across a concurrent commit", async () => {
    const { customer: contact } = await receivables.createCustomer(actor, {
      idempotencyKey: key(),
      name: "Before concurrent update",
    });
    const snapshotRepository = createReceivablesRepository(
      beforeFirstExecute(database.db, async () => {
        await receivables.updateCustomer(actor, contact.id, {
          idempotencyKey: key(),
          name: "After concurrent update",
        });
        await receivables.postReceivable(actor, {
          idempotencyKey: key(),
          customerId: contact.id,
          originalMinorUnits: "500",
          description: "Concurrent charge",
          postedDate: "2026-08-01",
        });
      }),
    );
    const before = await snapshotRepository.getCustomer(actor, contact.id);
    expect(before.customer.name).toBe("Before concurrent update");
    expect(before.balance.outstandingMinorUnits).toBe("0");
    const after = await receivables.getCustomer(actor, contact.id);
    expect(after.customer.name).toBe("After concurrent update");
    expect(after.balance.outstandingMinorUnits).toBe("500");
  });

  test("rejects partial price snapshots and voids without reasons at the database boundary", async () => {
    const item = await catalog.createProduct(actor, {
      idempotencyKey: key(),
      name: "Constraint product",
      categoryId: null,
      sku: null,
      sellingPriceMinorUnits: null,
      unitKind: "unit",
      quantityPrecision: 0,
      tracked: false,
      lowStockThresholdMinorUnits: null,
    });
    for (let shape = 1; shape < 7; shape += 1) {
      await expect(
        database.db
          .update(catalogProduct)
          .set({
            sellingPriceMinorUnits: shape & 1 ? 100n : null,
            sellingPriceCurrency: shape & 2 ? "USD" : null,
            sellingPriceCurrencyMinorUnitDigits: shape & 4 ? 2 : null,
          })
          .where(eq(catalogProduct.id, item.product.id))
          .execute(),
      ).rejects.toMatchObject({
        cause: { code: "23514", constraint_name: "catalog_product_price_snapshot_check" },
      });
    }
    await database.db
      .update(catalogProduct)
      .set({
        sellingPriceMinorUnits: 100n,
        sellingPriceCurrency: "USD",
        sellingPriceCurrencyMinorUnitDigits: 2,
      })
      .where(eq(catalogProduct.id, item.product.id));
    expect((await catalog.getProduct(actor, item.product.id)).product.sellingPriceMinorUnits).toBe(
      "100",
    );

    const account = await cash.createAccount(actor, {
      idempotencyKey: key(),
      name: "Constraint cash",
      kind: "cash",
      currency: "USD",
      allowNegativeBalance: true,
      opening: null,
    });
    const spending = await cash.postExpense(actor, {
      idempotencyKey: key(),
      accountId: account.account.id,
      amountMinorUnits: "10",
      currency: "USD",
      category: "other",
      description: "Constraint expense",
      occurredLocalDate: "2026-08-01",
      occurredLocalTime: "10:00",
    });
    await expect(
      database.db
        .update(expense)
        .set({
          status: "voided",
          voidedAt: new Date(),
          voidedByUserId: ownerId,
          voidReason: null,
        })
        .where(eq(expense.id, spending.expense.id))
        .execute(),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "expense_void_shape_check" },
    });
    expect((await cash.getExpense(actor, spending.expense.id)).status).toBe("posted");

    const contact = await receivables.createCustomer(actor, {
      idempotencyKey: key(),
      name: "Constraint contact",
    });
    const debt = await receivables.postReceivable(actor, {
      idempotencyKey: key(),
      customerId: contact.customer.id,
      originalMinorUnits: "10",
      description: "Constraint charge",
      postedDate: "2026-08-01",
    });
    await expect(
      database.db
        .update(receivable)
        .set({
          status: "voided",
          voidedAt: new Date(),
          voidedByUserId: ownerId,
          voidReason: null,
        })
        .where(eq(receivable.id, debt.receivable.id))
        .execute(),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint_name: "receivable_void_state_check" },
    });
    expect((await receivables.getReceivable(actor, debt.receivable.id)).receivable.state).toBe(
      "open",
    );
  });
});
