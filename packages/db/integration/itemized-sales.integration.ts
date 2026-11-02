import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { CreateItemizedSaleRequest } from "@pisto/contracts";
import { and, count, eq, inArray } from "drizzle-orm";

import {
  businessSettings,
  createBusinessRepository,
  createCashRepository,
  createCatalogRepository,
  createDatabase,
  createReceivablesRepository,
  createSalesRepository,
  member,
  organization,
  ProductError,
  parseDatabaseConfig,
  sale,
  saleCorrection,
  saleLine,
  saleOperation,
  session,
  user,
} from "../src/index.ts";
import { cashAccount, cashMovement, cashOperationReceipt } from "../src/schema/cash.ts";
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

const database = createDatabase({ ...parseDatabaseConfig(process.env), maxConnections: 6 });
const businesses = createBusinessRepository(database.db);
const cash = createCashRepository(database.db);
const catalog = createCatalogRepository(database.db);
const receivables = createReceivablesRepository(database.db);
const sales = createSalesRepository(database.db);
const runId = crypto.randomUUID();
const roles = ["ownerA", "admin", "member", "ownerB"] as const;
type Role = (typeof roles)[number];
const userIds = Object.fromEntries(roles.map((role) => [role, `itemized-${role}-${runId}`])) as {
  [K in Role]: string;
};
const sessionIds = Object.fromEntries(
  roles.map((role) => [role, `itemized-session-${role}-${runId}`]),
) as { [K in Role]: string };
const businessIds: string[] = [];
const fixture = {
  businessA: "",
  businessB: "",
  cashId: "",
  bankId: "",
  archivedAccountId: "",
  customerId: "",
  coffeeId: "",
  cheeseId: "",
  bagId: "",
  archivedProductId: "",
  foreignProductId: "",
  foreignCustomerId: "",
  foreignAccountId: "",
};

const actor = (role: Role) => ({
  userId: userIds[role],
  sessionId: sessionIds[role],
  activeBusinessId: role === "ownerB" ? fixture.businessB : fixture.businessA,
});

async function rejection(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ProductError) return error.code;
    throw error;
  }
  throw new Error("Expected the command to be refused");
}

async function countRows(table: typeof sale | typeof receivable): Promise<number> {
  const [row] = await database.db
    .select({ value: count() })
    .from(table)
    .where(eq(table.businessId, fixture.businessA));
  return row?.value ?? 0;
}

async function onHand(productId: string): Promise<string> {
  const detail = await catalog.getProduct(actor("ownerA"), productId);
  if (!detail.stock) throw new Error("The product does not track stock");
  return detail.stock.onHandMinorUnits;
}

async function balance(accountId: string): Promise<string> {
  return (await cash.getAccount(actor("ownerA"), accountId)).balanceMinorUnits;
}

function command(overrides: Partial<CreateItemizedSaleRequest> = {}): CreateItemizedSaleRequest {
  return {
    idempotencyKey: crypto.randomUUID(),
    occurredLocalDate: "2026-11-02",
    occurredLocalTime: "10:15",
    lines: [{ productId: fixture.coffeeId, quantityMinorUnits: "2" }],
    payment: { method: "cash", accountId: fixture.cashId, receivedMinorUnits: "650" },
    ...overrides,
  };
}

async function createProduct(
  role: Role,
  input: {
    name: string;
    price: string | null;
    precision: number;
    tracked: boolean;
    unitKind?: "unit" | "kilogram";
    stock?: string;
  },
): Promise<string> {
  const created = await catalog.createProduct(actor(role), {
    idempotencyKey: crypto.randomUUID(),
    name: `${input.name} ${runId.slice(0, 8)}`,
    quantityPrecision: input.precision,
    sellingPriceMinorUnits: input.price,
    tracked: input.tracked,
    unitKind: input.unitKind ?? "unit",
  });
  if (input.stock) {
    await catalog.recordMovement(actor(role), created.product.id, {
      idempotencyKey: crypto.randomUUID(),
      action: "receive",
      quantityMinorUnits: input.stock,
      reason: "Opening count",
      occurredLocalDate: "2026-11-01",
      occurredLocalTime: "08:00",
    });
  }
  return created.product.id;
}

async function createAccount(role: Role, name: string, kind: "cash" | "bank"): Promise<string> {
  const created = await cash.createAccount(actor(role), {
    idempotencyKey: crypto.randomUUID(),
    name: `${name} ${runId.slice(0, 8)}`,
    kind,
    allowNegativeBalance: false,
    currency: "USD",
    opening: null,
  });
  return created.account.id;
}

beforeAll(async () => {
  await database.db.insert(user).values(
    roles.map((role) => ({
      id: userIds[role],
      name: `Itemized ${role}`,
      email: `itemized-${role}-${runId}@example.test`,
      emailVerified: true,
    })),
  );
  await database.db.insert(session).values(
    roles.map((role) => ({
      id: sessionIds[role],
      token: `itemized-token-${role}-${runId}`,
      userId: userIds[role],
      expiresAt: new Date(Date.now() + 10 * 60_000),
    })),
  );
  const createdA = await businesses.createBusiness(actor("ownerA"), {
    name: `Itemized Store A ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  const createdB = await businesses.createBusiness(actor("ownerB"), {
    name: `Itemized Store B ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  fixture.businessA = createdA.business.id;
  fixture.businessB = createdB.business.id;
  businessIds.push(fixture.businessA, fixture.businessB);
  await database.db.insert(member).values(
    (["admin", "member"] as const).map((role) => ({
      id: crypto.randomUUID(),
      organizationId: fixture.businessA,
      userId: userIds[role],
      role,
    })),
  );
  await database.db
    .update(session)
    .set({ activeOrganizationId: fixture.businessA })
    .where(inArray(session.id, [sessionIds.admin, sessionIds.member]));

  fixture.cashId = await createAccount("ownerA", "Caja", "cash");
  fixture.bankId = await createAccount("ownerA", "Banco", "bank");
  fixture.archivedAccountId = await createAccount("ownerA", "Vieja", "cash");
  await cash.archiveAccount(actor("ownerA"), fixture.archivedAccountId, {
    idempotencyKey: crypto.randomUUID(),
  });
  fixture.customerId = (
    await receivables.createCustomer(actor("ownerA"), {
      idempotencyKey: crypto.randomUUID(),
      name: "Carlos Rivas",
    })
  ).customer.id;
  fixture.coffeeId = await createProduct("ownerA", {
    name: "Coffee",
    price: "325",
    precision: 0,
    tracked: true,
    stock: "20",
  });
  fixture.cheeseId = await createProduct("ownerA", {
    name: "Cheese",
    price: "333",
    precision: 3,
    tracked: true,
    unitKind: "kilogram",
    stock: "10000",
  });
  fixture.bagId = await createProduct("ownerA", {
    name: "Bag",
    price: null,
    precision: 0,
    tracked: false,
  });
  fixture.archivedProductId = await createProduct("ownerA", {
    name: "Retired",
    price: "100",
    precision: 0,
    tracked: false,
  });
  await catalog.archiveProduct(actor("ownerA"), fixture.archivedProductId, {
    idempotencyKey: crypto.randomUUID(),
  });
  fixture.foreignProductId = await createProduct("ownerB", {
    name: "Foreign",
    price: "100",
    precision: 0,
    tracked: false,
  });
  fixture.foreignCustomerId = (
    await receivables.createCustomer(actor("ownerB"), {
      idempotencyKey: crypto.randomUUID(),
      name: "Foreign customer",
    })
  ).customer.id;
  fixture.foreignAccountId = await createAccount("ownerB", "Foreign", "cash");
});

afterAll(async () => {
  if (businessIds.length > 0) {
    const scoped = <T extends { businessId: unknown }>(table: T) =>
      inArray(table.businessId as typeof sale.businessId, businessIds);
    await database.db.delete(saleCorrection).where(scoped(saleCorrection));
    await database.db.delete(saleOperation).where(scoped(saleOperation));
    await database.db.delete(saleLine).where(scoped(saleLine));
    await database.db.delete(catalogOperation).where(scoped(catalogOperation));
    await database.db.delete(inventoryMovement).where(scoped(inventoryMovement));
    await database.db.delete(cashMovement).where(scoped(cashMovement));
    await database.db.delete(cashOperationReceipt).where(scoped(cashOperationReceipt));
    await database.db.delete(receivableOperation).where(scoped(receivableOperation));
    await database.db.delete(receivablePayment).where(scoped(receivablePayment));
    await database.db.delete(sale).where(scoped(sale));
    await database.db.delete(receivable).where(scoped(receivable));
    await database.db.delete(customer).where(scoped(customer));
    await database.db.delete(cashAccount).where(scoped(cashAccount));
    await database.db.delete(catalogProduct).where(scoped(catalogProduct));
    await database.db.delete(catalogCategory).where(scoped(catalogCategory));
    await database.db.delete(businessSettings).where(scoped(businessSettings));
    await database.db.delete(member).where(inArray(member.organizationId, businessIds));
  }
  await database.db.delete(session).where(inArray(session.id, Object.values(sessionIds)));
  if (businessIds.length > 0) {
    await database.db.delete(organization).where(inArray(organization.id, businessIds));
  }
  await database.db.delete(user).where(inArray(user.id, Object.values(userIds)));
  await database.close();
});

describe("itemized sales on PostgreSQL 18", () => {
  test("a seller's credit sale takes stock, receives cash and opens the balance as a debt", async () => {
    const coffeeBefore = await onHand(fixture.coffeeId);
    const cheeseBefore = await onHand(fixture.cheeseId);
    const cashBefore = await balance(fixture.cashId);
    const result = await sales.createItemizedSale(
      actor("member"),
      command({
        customerId: fixture.customerId,
        lines: [
          { productId: fixture.coffeeId, quantityMinorUnits: "3" },
          // 1.250 kg at 3.33 per kg is 4.1625, which rounds half up to 4.16.
          { productId: fixture.cheeseId, quantityMinorUnits: "1250" },
          { productId: fixture.bagId, quantityMinorUnits: "1", unitPriceMinorUnits: "5" },
        ],
        payment: { method: "transfer", accountId: fixture.bankId, receivedMinorUnits: "1000" },
        dueDate: "2026-11-30",
        entrySource: "voice",
      }),
    );

    expect(result.replayed).toBe(false);
    expect(result.sale).toMatchObject({
      entryMode: "itemized",
      entrySource: "voice",
      grossMinorUnits: "1396",
      customer: { id: fixture.customerId, name: "Carlos Rivas" },
      status: "posted",
    });
    expect(
      result.lines.map(({ quantityMinorUnits, unitPriceMinorUnits, subtotalMinorUnits }) => [
        quantityMinorUnits,
        unitPriceMinorUnits,
        subtotalMinorUnits,
      ]),
    ).toEqual([
      ["3", "325", "975"],
      ["1250", "333", "416"],
      ["1", "5", "5"],
    ]);
    expect(result.settlement).toMatchObject({
      customerName: "Carlos Rivas",
      paymentMethod: "transfer",
      accountId: fixture.bankId,
      receivedMinorUnits: "1000",
      creditMinorUnits: "396",
      dueDate: "2026-11-30",
    });
    expect(await onHand(fixture.coffeeId)).toBe((BigInt(coffeeBefore) - 3n).toString());
    expect(await onHand(fixture.cheeseId)).toBe((BigInt(cheeseBefore) - 1250n).toString());
    expect(await balance(fixture.bankId)).toBe("1000");
    expect(await balance(fixture.cashId)).toBe(cashBefore);
    const receivableId = result.settlement.receivableId;
    if (!receivableId) throw new Error("A credit sale must open a receivable");
    const debt = await receivables.getReceivable(actor("ownerA"), receivableId);
    expect(debt.receivable).toMatchObject({
      customerId: fixture.customerId,
      originalMinorUnits: "396",
      outstandingMinorUnits: "396",
      postedDate: "2026-11-02",
      dueDate: "2026-11-30",
    });
    const bagMovements = await database.db
      .select({ id: inventoryMovement.id })
      .from(inventoryMovement)
      .where(eq(inventoryMovement.productId, fixture.bagId));
    expect(bagMovements).toEqual([]);

    const detail = await sales.getSale(actor("member"), result.sale.id);
    expect(detail.sale).toEqual(result.sale);
    expect(detail.details).toEqual({ lines: result.lines, settlement: result.settlement });
    const list = await sales.listSales(actor("member"), { status: "all", limit: 50 });
    expect(list.items.find(({ id }) => id === result.sale.id)?.customer?.name).toBe("Carlos Rivas");
  });

  test("charges the catalog price, replays exactly and refuses a changed command or key reuse", async () => {
    const original = command();
    const first = await sales.createItemizedSale(actor("member"), original);
    const stockAfterFirst = await onHand(fixture.coffeeId);
    const cashAfterFirst = await balance(fixture.cashId);
    const replay = await sales.createItemizedSale(actor("member"), {
      ...original,
      idempotencyKey: original.idempotencyKey.toUpperCase(),
    });

    expect(first.lines[0]?.unitPriceMinorUnits).toBe("325");
    expect(first.sale.grossMinorUnits).toBe("650");
    expect(first.settlement.creditMinorUnits).toBe("0");
    expect(replay).toEqual({ ...first, replayed: true });
    expect(await onHand(fixture.coffeeId)).toBe(stockAfterFirst);
    expect(await balance(fixture.cashId)).toBe(cashAfterFirst);
    expect(
      await rejection(
        sales.createItemizedSale(actor("member"), {
          ...original,
          lines: [{ productId: fixture.coffeeId, quantityMinorUnits: "1" }],
          payment: { method: "cash", accountId: fixture.cashId, receivedMinorUnits: "325" },
        }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
    expect(
      await rejection(
        sales.createSale(actor("member"), {
          idempotencyKey: original.idempotencyKey,
          grossMinorUnits: "650",
          occurredLocalDate: "2026-11-02",
          occurredLocalTime: "10:15",
        }),
      ),
    ).toBe("IDEMPOTENCY_CONFLICT");
  });

  test("refuses a sale beyond tracked stock and leaves stock, cash and debts unchanged", async () => {
    const stock = await onHand(fixture.coffeeId);
    const cashBefore = await balance(fixture.cashId);
    const salesBefore = await countRows(sale);
    const debtsBefore = await countRows(receivable);
    const code = await rejection(
      sales.createItemizedSale(
        actor("member"),
        command({
          customerId: fixture.customerId,
          lines: [
            { productId: fixture.coffeeId, quantityMinorUnits: (BigInt(stock) + 1n).toString() },
          ],
          payment: undefined,
          dueDate: "2026-11-30",
        }),
      ),
    );

    expect(code).toBe("CONFLICT");
    expect(await onHand(fixture.coffeeId)).toBe(stock);
    expect(await balance(fixture.cashId)).toBe(cashBefore);
    expect(await countRows(sale)).toBe(salesBefore);
    expect(await countRows(receivable)).toBe(debtsBefore);
  });

  test("applies the credit, price and line rules before writing anything", async () => {
    const refusals = await Promise.all(
      [
        // A balance needs a customer.
        sales.createItemizedSale(
          actor("member"),
          command({ payment: undefined, dueDate: "2026-11-30" }),
        ),
        // A balance needs the agreed date.
        sales.createItemizedSale(
          actor("member"),
          command({ customerId: fixture.customerId, payment: undefined }),
        ),
        // More received than the total.
        sales.createItemizedSale(
          actor("member"),
          command({
            payment: { method: "cash", accountId: fixture.cashId, receivedMinorUnits: "651" },
          }),
        ),
        // A fully paid sale has no payment date.
        sales.createItemizedSale(actor("member"), command({ dueDate: "2026-11-30" })),
        // The agreed date cannot precede the sale.
        sales.createItemizedSale(
          actor("member"),
          command({ customerId: fixture.customerId, payment: undefined, dueDate: "2026-11-01" }),
        ),
        // No catalog price and no line price.
        sales.createItemizedSale(
          actor("member"),
          command({
            lines: [{ productId: fixture.bagId, quantityMinorUnits: "1" }],
            payment: undefined,
          }),
        ),
        // The same product twice.
        sales.createItemizedSale(
          actor("member"),
          command({
            lines: [
              { productId: fixture.coffeeId, quantityMinorUnits: "1" },
              { productId: fixture.coffeeId, quantityMinorUnits: "1" },
            ],
          }),
        ),
        // A zero total.
        sales.createItemizedSale(
          actor("member"),
          command({
            lines: [
              { productId: fixture.bagId, quantityMinorUnits: "1", unitPriceMinorUnits: "0" },
            ],
            payment: undefined,
          }),
        ),
      ].map(rejection),
    );
    expect(refusals).toEqual(Array(8).fill("VALIDATION_ERROR"));

    expect(
      await rejection(
        sales.createItemizedSale(
          actor("member"),
          command({ lines: [{ productId: fixture.archivedProductId, quantityMinorUnits: "1" }] }),
        ),
      ),
    ).toBe("CONFLICT");
    expect(
      await rejection(
        sales.createItemizedSale(
          actor("member"),
          command({
            payment: {
              method: "cash",
              accountId: fixture.archivedAccountId,
              receivedMinorUnits: "650",
            },
          }),
        ),
      ),
    ).toBe("CONFLICT");
  });

  test("keeps another business's products, customers, accounts and sales out of reach", async () => {
    const foreign = await Promise.all(
      [
        command({ lines: [{ productId: fixture.foreignProductId, quantityMinorUnits: "1" }] }),
        command({ customerId: fixture.foreignCustomerId }),
        command({
          payment: {
            method: "cash",
            accountId: fixture.foreignAccountId,
            receivedMinorUnits: "650",
          },
        }),
      ].map((body) => rejection(sales.createItemizedSale(actor("member"), body))),
    );
    expect(foreign).toEqual(["NOT_FOUND", "NOT_FOUND", "NOT_FOUND"]);

    const own = await sales.createItemizedSale(actor("member"), command());
    expect(await rejection(sales.getSale(actor("ownerB"), own.sale.id))).toBe("NOT_FOUND");
    expect(
      await rejection(
        sales.voidSale(actor("ownerB"), own.sale.id, {
          idempotencyKey: crypto.randomUUID(),
          reason: "Not ours",
        }),
      ),
    ).toBe("NOT_FOUND");

    const options = await sales.getSaleFormOptions(actor("member"));
    expect(options.accounts.map(({ id }) => id).sort()).toEqual(
      [fixture.cashId, fixture.bankId].sort(),
    );
    expect(options.accounts.find(({ id }) => id === fixture.bankId)?.kind).toBe("bank");
  });

  test("voiding needs sales:correct and undoes stock, cash and the debt in one transaction", async () => {
    const coffeeBefore = await onHand(fixture.coffeeId);
    const cashBefore = await balance(fixture.cashId);
    const posted = await sales.createItemizedSale(
      actor("member"),
      command({
        customerId: fixture.customerId,
        lines: [{ productId: fixture.coffeeId, quantityMinorUnits: "4" }],
        payment: { method: "cash", accountId: fixture.cashId, receivedMinorUnits: "300" },
        dueDate: "2026-11-15",
      }),
    );
    const receivableId = posted.settlement.receivableId;
    if (!receivableId) throw new Error("A credit sale must open a receivable");
    const voidCommand = { idempotencyKey: crypto.randomUUID(), reason: "Wrong customer" };

    expect(await rejection(sales.voidSale(actor("member"), posted.sale.id, voidCommand))).toBe(
      "FORBIDDEN",
    );
    expect(
      await rejection(
        sales.replaceSale(actor("admin"), posted.sale.id, {
          idempotencyKey: crypto.randomUUID(),
          reason: "Wrong total",
          replacement: {
            grossMinorUnits: "100",
            occurredLocalDate: "2026-11-02",
            occurredLocalTime: "10:15",
          },
        }),
      ),
    ).toBe("CONFLICT");
    // Only the sale may undo what it wrote.
    const [stockMovement] = await database.db
      .select({ id: inventoryMovement.id })
      .from(inventoryMovement)
      .where(eq(inventoryMovement.saleId, posted.sale.id));
    if (!stockMovement) throw new Error("A tracked line must write a stock movement");
    expect(
      await rejection(
        catalog.reverseMovement(actor("ownerA"), stockMovement.id, {
          idempotencyKey: crypto.randomUUID(),
          reason: "Undo",
          occurredLocalDate: "2026-11-02",
          occurredLocalTime: "11:00",
        }),
      ),
    ).toBe("CONFLICT");
    expect(
      await rejection(
        receivables.voidReceivable(actor("ownerA"), receivableId, {
          idempotencyKey: crypto.randomUUID(),
          reason: "Undo",
        }),
      ),
    ).toBe("CONFLICT");

    const voided = await sales.voidSale(actor("admin"), posted.sale.id, voidCommand);
    expect(voided.originalSale).toMatchObject({
      status: "voided",
      customer: { id: fixture.customerId, name: "Carlos Rivas" },
    });
    expect(voided.correction.kind).toBe("void");
    expect(await onHand(fixture.coffeeId)).toBe(coffeeBefore);
    expect(await balance(fixture.cashId)).toBe(cashBefore);
    const debt = await receivables.getReceivable(actor("ownerA"), receivableId);
    expect(debt.receivable).toMatchObject({ state: "voided", voidReason: "Wrong customer" });
    const replay = await sales.voidSale(actor("admin"), posted.sale.id, voidCommand);
    expect(replay.replayed).toBe(true);
    expect(await onHand(fixture.coffeeId)).toBe(coffeeBefore);
    const reversals = await database.db
      .select({ reason: cashMovement.reason, amount: cashMovement.amountMinorUnits })
      .from(cashMovement)
      .where(
        and(eq(cashMovement.businessId, fixture.businessA), eq(cashMovement.action, "reverse")),
      );
    expect(reversals).toContainEqual({ reason: "Wrong customer", amount: 300n });
  });

  test("refuses to void a sale whose debt already received a payment", async () => {
    const posted = await sales.createItemizedSale(
      actor("member"),
      command({ customerId: fixture.customerId, payment: undefined, dueDate: "2026-11-20" }),
    );
    const receivableId = posted.settlement.receivableId;
    if (!receivableId) throw new Error("A credit sale must open a receivable");
    await receivables.applyPayment(actor("ownerA"), receivableId, {
      idempotencyKey: crypto.randomUUID(),
      amountMinorUnits: "100",
      occurredLocalDate: "2026-11-03",
      occurredLocalTime: "09:00",
      cashAccountId: fixture.cashId,
    });
    const stock = await onHand(fixture.coffeeId);

    expect(
      await rejection(
        sales.voidSale(actor("ownerA"), posted.sale.id, {
          idempotencyKey: crypto.randomUUID(),
          reason: "Customer returned it",
        }),
      ),
    ).toBe("CONFLICT");
    expect((await sales.getSale(actor("ownerA"), posted.sale.id)).sale.status).toBe("posted");
    expect(await onHand(fixture.coffeeId)).toBe(stock);
  });
});
