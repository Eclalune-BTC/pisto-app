import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";

import {
  businessSettings,
  createBusinessRepository,
  createCashRepository,
  createCatalogRepository,
  createDatabase,
  createMovementsRepository,
  member,
  organization,
  parseDatabaseConfig,
  session,
  user,
} from "../src/index.ts";
import { createPurchasesRepository } from "../src/purchases.ts";
import { cashAccount, cashMovement, cashOperationReceipt } from "../src/schema/cash.ts";
import {
  catalogCategory,
  catalogOperation,
  catalogProduct,
  inventoryMovement,
} from "../src/schema/catalog.ts";
import {
  purchase,
  purchaseLine,
  purchaseOperation,
  supplier,
  supplierPayment,
} from "../src/schema/purchases.ts";

const database = createDatabase({ ...parseDatabaseConfig(process.env), maxConnections: 8 });
const businesses = createBusinessRepository(database.db);
const cash = createCashRepository(database.db);
const catalog = createCatalogRepository(database.db);
const repository = createPurchasesRepository(database.db);
const ledger = createMovementsRepository(database.db);
const runId = crypto.randomUUID();
const userIds = {
  admin: `purchases-admin-${runId}`,
  member: `purchases-member-${runId}`,
  ownerA: `purchases-owner-a-${runId}`,
  ownerB: `purchases-owner-b-${runId}`,
};
const sessionIds = {
  admin: `purchases-session-admin-${runId}`,
  member: `purchases-session-member-${runId}`,
  ownerA: `purchases-session-owner-a-${runId}`,
  ownerB: `purchases-session-owner-b-${runId}`,
};
const businessIds: string[] = [];
let businessA = "";
let businessB = "";
let tillId = "";
let bankId = "";
let trackedId = "";
let bulkId = "";
let serviceId = "";
let today = "";

const actor = (key: keyof typeof userIds, businessId = businessA) => ({
  userId: userIds[key],
  sessionId: sessionIds[key],
  activeBusinessId: businessId,
});
const key = () => crypto.randomUUID();
const at = { occurredLocalDate: "", occurredLocalTime: "09:30" };

function shiftDate(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function onHand(productId: string, businessId = businessA): Promise<string> {
  const { stock } = await catalog.getProduct(actor("ownerA", businessId), productId);
  if (!stock) throw new Error("Expected a tracked product");
  return stock.onHandMinorUnits;
}

async function balanceOf(accountId: string): Promise<string> {
  return (await cash.getAccount(actor("ownerA"), accountId)).balanceMinorUnits;
}

async function newSupplier(name: string, owner = actor("ownerA")) {
  const { supplier: created } = await repository.createSupplier(owner, {
    idempotencyKey: key(),
    name,
    creditDays: 15,
  });
  return created;
}

function creditPurchase(
  supplierId: string,
  overrides: Partial<Parameters<typeof repository.createPurchase>[1]> = {},
) {
  return {
    idempotencyKey: key(),
    supplierId,
    invoiceNumber: "F-1043",
    occurredLocalDate: shiftDate(today, -1),
    occurredLocalTime: "09:30",
    lines: [{ productId: trackedId, quantityMinorUnits: "48", unitCostMinorUnits: "160" }],
    received: true,
    paymentTerms: "credit" as const,
    dueDate: shiftDate(today, 14),
    ...overrides,
  };
}

beforeAll(async () => {
  await database.db.insert(user).values(
    Object.entries(userIds).map(([name, id]) => ({
      id,
      name: `Purchases ${name}`,
      email: `purchases-${name}-${runId}@example.test`,
      emailVerified: true,
    })),
  );
  await database.db.insert(session).values(
    Object.entries(sessionIds).map(([name, id]) => ({
      id,
      token: `purchases-token-${name}-${runId}`,
      userId: userIds[name as keyof typeof userIds],
      expiresAt: new Date(Date.now() + 10 * 60_000),
    })),
  );
  const createdA = await businesses.createBusiness(actor("ownerA", ""), {
    name: `Purchases Store A ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  // A business on the far side of the date line proves states use the business calendar.
  const createdB = await businesses.createBusiness(actor("ownerB", ""), {
    name: `Purchases Store B ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "Pacific/Kiritimati",
  });
  businessA = createdA.business.id;
  businessB = createdB.business.id;
  businessIds.push(businessA, businessB);
  await database.db.insert(member).values([
    { id: crypto.randomUUID(), organizationId: businessA, userId: userIds.admin, role: "admin" },
    { id: crypto.randomUUID(), organizationId: businessA, userId: userIds.member, role: "member" },
  ]);
  for (const name of ["admin", "member"] as const) {
    await database.db
      .update(session)
      .set({ activeOrganizationId: businessA })
      .where(eq(session.id, sessionIds[name]));
  }

  const owner = actor("ownerA");
  today = (await repository.getPayablesSummary(owner)).businessLocalDate;
  at.occurredLocalDate = today;
  const till = await cash.createAccount(owner, {
    idempotencyKey: key(),
    name: `Caja ${runId.slice(0, 8)}`,
    kind: "cash",
    allowNegativeBalance: false,
    currency: "USD",
    opening: { direction: "in", amountMinorUnits: "50000", reason: "Fondo", ...at },
  });
  const bank = await cash.createAccount(owner, {
    idempotencyKey: key(),
    name: `Banco ${runId.slice(0, 8)}`,
    kind: "bank",
    allowNegativeBalance: false,
    currency: "USD",
    opening: { direction: "in", amountMinorUnits: "1000", reason: "Saldo", ...at },
  });
  tillId = till.account.id;
  bankId = bank.account.id;
  const product = (name: string, quantityPrecision: number, tracked: boolean) =>
    catalog.createProduct(owner, {
      idempotencyKey: key(),
      name: `${name} ${runId.slice(0, 8)}`,
      unitKind: quantityPrecision === 0 ? "unit" : "kilogram",
      quantityPrecision,
      tracked,
      categoryId: null,
      sku: null,
      sellingPriceMinorUnits: null,
      lowStockThresholdMinorUnits: null,
    });
  trackedId = (await product("Gaseosa 2.5 L", 0, true)).product.id;
  bulkId = (await product("Queso duro", 3, true)).product.id;
  serviceId = (await product("Flete", 0, false)).product.id;
});

afterAll(async () => {
  if (businessIds.length > 0) {
    const scoped = <T extends { businessId: unknown }>(table: T) =>
      inArray(table.businessId as never, businessIds);
    await database.db.delete(purchaseOperation).where(scoped(purchaseOperation));
    await database.db.delete(cashMovement).where(scoped(cashMovement));
    await database.db.delete(supplierPayment).where(scoped(supplierPayment));
    await database.db.delete(purchaseLine).where(scoped(purchaseLine));
    await database.db.delete(purchase).where(scoped(purchase));
    await database.db.delete(supplier).where(scoped(supplier));
    await database.db.delete(catalogOperation).where(scoped(catalogOperation));
    await database.db.delete(inventoryMovement).where(scoped(inventoryMovement));
    await database.db.delete(catalogProduct).where(scoped(catalogProduct));
    await database.db.delete(catalogCategory).where(scoped(catalogCategory));
    await database.db.delete(cashOperationReceipt).where(scoped(cashOperationReceipt));
    await database.db.delete(cashAccount).where(scoped(cashAccount));
  }
  await database.db.delete(member).where(inArray(member.userId, Object.values(userIds)));
  await database.db.delete(session).where(inArray(session.id, Object.values(sessionIds)));
  if (businessIds.length > 0) {
    await database.db
      .delete(businessSettings)
      .where(inArray(businessSettings.businessId, businessIds));
    await database.db.delete(organization).where(inArray(organization.id, businessIds));
  }
  await database.db.delete(user).where(inArray(user.id, Object.values(userIds)));
  await database.close();
});

describe("suppliers, purchases and payables on PostgreSQL 18", () => {
  test("computes exact line costs, enters received stock and opens the payable", async () => {
    const vendor = await newSupplier("Distribuidora Centro");
    const before = await onHand(trackedId);
    const bulkBefore = await onHand(bulkId);
    const { purchase: created, replayed } = await repository.createPurchase(
      actor("ownerA"),
      creditPurchase(vendor.id, {
        lines: [
          { productId: trackedId, quantityMinorUnits: "48", unitCostMinorUnits: "160" },
          // 1.250 kg at $3.99 rounds half up to $4.99.
          { productId: bulkId, quantityMinorUnits: "1250", unitCostMinorUnits: "399" },
          { productId: serviceId, quantityMinorUnits: "1", unitCostMinorUnits: "500" },
        ],
      }),
    );

    expect(replayed).toBe(false);
    expect(created.lines.map(({ subtotalMinorUnits }) => subtotalMinorUnits)).toEqual([
      "7680",
      "499",
      "500",
    ]);
    expect(created).toMatchObject({
      totalMinorUnits: "8679",
      paidMinorUnits: "0",
      balanceMinorUnits: "8679",
      payableState: "open",
      received: true,
      supplierName: "Distribuidora Centro",
      entrySource: "manual",
    });
    expect(BigInt(await onHand(trackedId)) - BigInt(before)).toBe(48n);
    expect(BigInt(await onHand(bulkId)) - BigInt(bulkBefore)).toBe(1250n);
    const movements = await database.db
      .select({ reason: inventoryMovement.reason, action: inventoryMovement.action })
      .from(purchaseLine)
      .innerJoin(inventoryMovement, eq(inventoryMovement.id, purchaseLine.inventoryMovementId))
      .where(eq(purchaseLine.purchaseId, created.id));
    expect(movements).toHaveLength(2);
    expect(movements[0]).toEqual({ action: "receive", reason: "Distribuidora Centro · F-1043" });
  });

  test("replays the exact command and refuses a changed one under the same key", async () => {
    const vendor = await newSupplier("Lácteos San Julián");
    const command = creditPurchase(vendor.id);
    const first = await repository.createPurchase(actor("ownerA"), command);
    const stock = await onHand(trackedId);
    const replay = await repository.createPurchase(actor("ownerA"), command);

    expect(replay).toEqual({ purchase: first.purchase, replayed: true });
    expect(await onHand(trackedId)).toBe(stock);
    await expect(
      repository.createPurchase(actor("ownerA"), { ...command, invoiceNumber: "F-9999" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  test("pays a cash purchase from one account and refuses one a protected account cannot cover", async () => {
    const vendor = await newSupplier("Abarrotes Mayoreo El Sol");
    const before = BigInt(await balanceOf(tillId));
    const { purchase: paid } = await repository.createPurchase(actor("ownerA"), {
      ...creditPurchase(vendor.id),
      paymentTerms: "cash",
      dueDate: undefined,
      accountId: tillId,
    });

    expect(paid).toMatchObject({
      paymentTerms: "cash",
      paidMinorUnits: "7680",
      balanceMinorUnits: "0",
      payableState: "paid",
      dueDate: null,
    });
    expect(BigInt(await balanceOf(tillId))).toBe(before - 7_680n);
    const [movement] = await database.db
      .select()
      .from(cashMovement)
      .where(eq(cashMovement.purchaseId, paid.id));
    expect(movement).toMatchObject({ action: "purchase_payment", direction: "out", reason: null });

    await expect(
      repository.createPurchase(actor("ownerA"), {
        ...creditPurchase(vendor.id),
        paymentTerms: "cash",
        dueDate: undefined,
        accountId: bankId,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "Cash account has insufficient funds" });
  });

  test("applies supplier payments up to the balance and marks a settled purchase paid", async () => {
    const vendor = await newSupplier("Panificadora Santa Rita");
    const { purchase: open } = await repository.createPurchase(
      actor("ownerA"),
      creditPurchase(vendor.id),
    );
    const payment = (amountMinorUnits: string, accountId = tillId) => ({
      idempotencyKey: key(),
      accountId,
      amountMinorUnits,
      ...at,
      reference: "Transferencia 001",
    });

    await expect(
      repository.createSupplierPayment(actor("ownerA"), open.id, payment("7681")),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "The payment exceeds the outstanding balance",
    });
    await expect(
      repository.createSupplierPayment(actor("ownerA"), open.id, payment("5000", bankId)),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "Cash account has insufficient funds" });

    const tillBefore = BigInt(await balanceOf(tillId));
    const partialCommand = payment("2680");
    const partial = await repository.createSupplierPayment(actor("admin"), open.id, partialCommand);
    expect(partial.purchase).toMatchObject({ paidMinorUnits: "2680", balanceMinorUnits: "5000" });
    expect(await repository.createSupplierPayment(actor("admin"), open.id, partialCommand)).toEqual(
      {
        ...partial,
        replayed: true,
      },
    );
    const settled = await repository.createSupplierPayment(
      actor("ownerA"),
      open.id,
      payment("5000"),
    );
    expect(settled.purchase).toMatchObject({ balanceMinorUnits: "0", payableState: "paid" });
    expect(BigInt(await balanceOf(tillId))).toBe(tillBefore - 7_680n);

    const detail = await repository.getPurchase(actor("ownerA"), open.id);
    expect(detail.payments.map(({ amountMinorUnits }) => amountMinorUnits).sort()).toEqual([
      "2680",
      "5000",
    ]);
    const movements = await database.db
      .select({ action: cashMovement.action, delta: cashMovement.deltaMinorUnits })
      .from(cashMovement)
      .innerJoin(supplierPayment, eq(supplierPayment.id, cashMovement.supplierPaymentId))
      .where(eq(supplierPayment.purchaseId, open.id));
    expect(movements.map(({ action }) => action)).toEqual(["supplier_payment", "supplier_payment"]);

    // The credit purchase moved no money itself; only its two payments did.
    const listed = await ledger.listMovements(actor("ownerA"), {
      startLocalDate: shiftDate(today, -1),
      endLocalDate: at.occurredLocalDate,
      query: "Panificadora Santa Rita",
    });
    expect(
      listed.items.map(({ kind, amountMinorUnits, parentRecordId, facts }) => ({
        kind,
        amountMinorUnits,
        parentRecordId,
        totalMinorUnits: facts.totalMinorUnits,
      })),
    ).toEqual(
      expect.arrayContaining([
        { kind: "purchase", amountMinorUnits: "0", parentRecordId: null, totalMinorUnits: "7680" },
        {
          kind: "supplier_payment",
          amountMinorUnits: "-2680",
          parentRecordId: open.id,
          totalMinorUnits: null,
        },
        {
          kind: "supplier_payment",
          amountMinorUnits: "-5000",
          parentRecordId: open.id,
          totalMinorUnits: null,
        },
      ]),
    );
    expect(listed.items).toHaveLength(3);
    expect(listed.totals).toEqual({
      inflowMinorUnits: "0",
      outflowMinorUnits: "7680",
      netMinorUnits: "-7680",
    });
    await expect(
      repository.voidPurchase(actor("ownerA"), open.id, { idempotencyKey: key(), reason: "Error" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("voids a received cash purchase by returning its stock and its money", async () => {
    const vendor = await newSupplier("Papelería y Empaques Díaz");
    const stockBefore = await onHand(trackedId);
    const tillBefore = await balanceOf(tillId);
    const { purchase: created } = await repository.createPurchase(actor("ownerA"), {
      ...creditPurchase(vendor.id),
      paymentTerms: "cash",
      dueDate: undefined,
      accountId: tillId,
    });
    const command = { idempotencyKey: key(), reason: "Factura duplicada" };
    const voided = await repository.voidPurchase(actor("ownerA"), created.id, command);

    expect(voided.purchase).toMatchObject({ status: "voided", balanceMinorUnits: "0" });
    expect(await onHand(trackedId)).toBe(stockBefore);
    expect(await balanceOf(tillId)).toBe(tillBefore);
    expect(await repository.voidPurchase(actor("ownerA"), created.id, command)).toEqual({
      ...voided,
      replayed: true,
    });
    await expect(
      repository.voidPurchase(actor("ownerA"), created.id, {
        idempotencyKey: key(),
        reason: "Otra",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      repository.createSupplierPayment(actor("ownerA"), created.id, {
        idempotencyKey: key(),
        accountId: tillId,
        amountMinorUnits: "1",
        ...at,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("refuses a void that would take more stock than is on hand", async () => {
    const vendor = await newSupplier("Bodega sin existencias");
    const { product } = await catalog.createProduct(actor("ownerA"), {
      idempotencyKey: key(),
      name: `Consumido ${runId.slice(0, 8)}`,
      unitKind: "unit",
      quantityPrecision: 0,
      tracked: true,
      categoryId: null,
      sku: null,
      sellingPriceMinorUnits: null,
      lowStockThresholdMinorUnits: null,
    });
    const { purchase: created } = await repository.createPurchase(
      actor("ownerA"),
      creditPurchase(vendor.id, {
        lines: [{ productId: product.id, quantityMinorUnits: "10", unitCostMinorUnits: "100" }],
      }),
    );
    await catalog.recordMovement(actor("ownerA"), product.id, {
      idempotencyKey: key(),
      action: "adjust_out",
      quantityMinorUnits: "4",
      reason: "Merma",
      ...at,
    });

    await expect(
      repository.voidPurchase(actor("ownerA"), created.id, {
        idempotencyKey: key(),
        reason: "Error",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await onHand(product.id)).toBe("6");
  });

  test("keeps received stock owned by its purchase, even after the product is archived", async () => {
    const owner = actor("ownerA");
    const vendor = await newSupplier("Propietario del inventario");
    const { product } = await catalog.createProduct(owner, {
      idempotencyKey: key(),
      name: `Archivable ${runId.slice(0, 8)}`,
      unitKind: "unit",
      quantityPrecision: 0,
      tracked: true,
      categoryId: null,
      sku: null,
      sellingPriceMinorUnits: null,
      lowStockThresholdMinorUnits: null,
    });
    const { purchase: created } = await repository.createPurchase(
      owner,
      creditPurchase(vendor.id, {
        lines: [{ productId: product.id, quantityMinorUnits: "5", unitCostMinorUnits: "100" }],
      }),
    );
    const [line] = await database.db
      .select({ movementId: purchaseLine.inventoryMovementId })
      .from(purchaseLine)
      .where(eq(purchaseLine.purchaseId, created.id));
    if (!line?.movementId) throw new Error("Expected a receipt movement");

    await expect(
      catalog.reverseMovement(owner, line.movementId, {
        idempotencyKey: key(),
        reason: "Error",
        ...at,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await catalog.archiveProduct(owner, product.id, { idempotencyKey: key() });
    const voided = await repository.voidPurchase(owner, created.id, {
      idempotencyKey: key(),
      reason: "Proveedor equivocado",
    });
    expect(voided.purchase.status).toBe("voided");
    expect(await onHand(product.id)).toBe("0");
  });

  test("refuses a total beyond the 64-bit ledger range as invalid input", async () => {
    const vendor = await newSupplier("Monto imposible");
    await expect(
      repository.createPurchase(
        actor("ownerA"),
        creditPurchase(vendor.id, {
          received: false,
          lines: [
            {
              productId: serviceId,
              quantityMinorUnits: "9000000000",
              unitCostMinorUnits: "9000000000",
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("receives an unreceived purchase once, later", async () => {
    const vendor = await newSupplier("Recepción tardía");
    const before = await onHand(trackedId);
    const { purchase: pending } = await repository.createPurchase(
      actor("ownerA"),
      creditPurchase(vendor.id, { received: false, invoiceNumber: undefined }),
    );
    expect(pending.received).toBe(false);
    expect(await onHand(trackedId)).toBe(before);

    const command = { idempotencyKey: key(), ...at, occurredLocalTime: "15:00" };
    const received = await repository.receivePurchase(actor("admin"), pending.id, command);
    expect(received.purchase.received).toBe(true);
    expect(BigInt(await onHand(trackedId)) - BigInt(before)).toBe(48n);
    expect(await repository.receivePurchase(actor("admin"), pending.id, command)).toEqual({
      ...received,
      replayed: true,
    });
    await expect(
      repository.receivePurchase(actor("admin"), pending.id, { ...command, idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("derives payable states and the summary from the business calendar", async () => {
    const vendor = await newSupplier("Estados de pago");
    const post = (dueDate: string) =>
      repository.createPurchase(
        actor("ownerA"),
        creditPurchase(vendor.id, {
          occurredLocalDate: shiftDate(today, -20),
          dueDate,
          received: false,
          lines: [{ productId: serviceId, quantityMinorUnits: "1", unitCostMinorUnits: "1000" }],
        }),
      );
    const overdue = await post(shiftDate(today, -1));
    const dueToday = await post(today);
    const dueInSeven = await post(shiftDate(today, 7));
    const later = await post(shiftDate(today, 8));

    expect(overdue.purchase.payableState).toBe("overdue");
    expect(dueToday.purchase.payableState).toBe("due_soon");
    expect(dueInSeven.purchase.payableState).toBe("due_soon");
    expect(later.purchase.payableState).toBe("open");

    const open = await repository.listPurchases(actor("ownerA"), {
      supplierId: vendor.id,
      payable: "open",
      limit: 2,
    });
    expect(open.items).toHaveLength(2);
    expect(open.nextCursor).not.toBeNull();
    const rest = await repository.listPurchases(actor("ownerA"), {
      supplierId: vendor.id,
      payable: "open",
      limit: 2,
      cursor: open.nextCursor ?? undefined,
    });
    expect(rest.items).toHaveLength(2);
    expect(rest.nextCursor).toBeNull();
    await expect(
      repository.listPurchases(actor("ownerA"), {
        payable: "paid",
        limit: 2,
        cursor: open.nextCursor ?? undefined,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const detail = await repository.getSupplier(actor("ownerA"), vendor.id);
    expect(detail.balance).toMatchObject({
      outstandingMinorUnits: "4000",
      overdueMinorUnits: "1000",
      openPurchaseCount: "4",
      lastPurchaseLocalDate: shiftDate(today, -20),
    });
    const summary = await repository.getPayablesSummary(actor("ownerA"));
    expect(BigInt(summary.dueSoonMinorUnits)).toBeGreaterThanOrEqual(2_000n);
    expect(BigInt(summary.overdueMinorUnits)).toBeGreaterThanOrEqual(1_000n);
    expect(summary.nextDue?.dueDate).toBe(today);
  });

  test("uses each business's own calendar for overdue balances", async () => {
    const owner = actor("ownerB", businessB);
    const { businessLocalDate } = await repository.getPayablesSummary(owner);
    const expected = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Kiritimati" }).format(
      new Date(),
    );
    expect(businessLocalDate).toBe(expected);
    const vendor = await newSupplier("Proveedor del Pacífico", owner);
    const { product } = await catalog.createProduct(owner, {
      idempotencyKey: key(),
      name: "Servicio",
      unitKind: "unit",
      quantityPrecision: 0,
      tracked: false,
      categoryId: null,
      sku: null,
      sellingPriceMinorUnits: null,
      lowStockThresholdMinorUnits: null,
    });
    const { purchase: created } = await repository.createPurchase(owner, {
      idempotencyKey: key(),
      supplierId: vendor.id,
      occurredLocalDate: shiftDate(businessLocalDate, -3),
      occurredLocalTime: "08:00",
      lines: [{ productId: product.id, quantityMinorUnits: "1", unitCostMinorUnits: "900" }],
      received: true,
      paymentTerms: "credit",
      dueDate: shiftDate(businessLocalDate, -1),
    });
    expect(created.payableState).toBe("overdue");
    expect((await repository.getPayablesSummary(owner)).overdueMinorUnits).toBe("900");
  });

  test("keeps suppliers and purchases inside their business and their roles", async () => {
    const vendor = await newSupplier("Privado A");
    const { purchase: created } = await repository.createPurchase(
      actor("ownerA"),
      creditPurchase(vendor.id, { received: false }),
    );
    const other = actor("ownerB", businessB);

    await expect(repository.getSupplier(other, vendor.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(repository.getPurchase(other, created.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(repository.createPurchase(other, creditPurchase(vendor.id))).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
    await expect(
      repository.createSupplierPayment(other, created.id, {
        idempotencyKey: key(),
        accountId: tillId,
        amountMinorUnits: "1",
        ...at,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (await repository.listPurchases(other, { limit: 50 })).items.some(
        ({ id }) => id === created.id,
      ),
    ).toBe(false);

    const seller = actor("member");
    await expect(repository.listSuppliers(seller, { limit: 25 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(repository.getPayablesSummary(seller)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      repository.createSupplier(seller, { idempotencyKey: key(), name: "No permitido" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await repository.getSupplier(actor("admin"), vendor.id)).supplier.name).toBe(
      "Privado A",
    );
  });

  test("filters suppliers by search and balance and archives only settled ones", async () => {
    const owner = actor("ownerA");
    const settledVendor = await newSupplier(`Saldado ${runId.slice(0, 6)}`);
    const owedVendor = await newSupplier(`Debido ${runId.slice(0, 6)}`);
    await repository.createPurchase(owner, creditPurchase(owedVendor.id, { received: false }));

    const owed = await repository.listSuppliers(owner, {
      balance: "outstanding",
      query: runId.slice(0, 6),
      limit: 25,
    });
    expect(owed.items.map(({ id }) => id)).toEqual([owedVendor.id]);
    expect(owed.items[0]?.balance.outstandingMinorUnits).toBe("7680");
    const all = await repository.listSuppliers(owner, { query: runId.slice(0, 6), limit: 25 });
    expect(all.items.map(({ id }) => id).sort()).toEqual([settledVendor.id, owedVendor.id].sort());

    await expect(
      repository.archiveSupplier(owner, owedVendor.id, { idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const archived = await repository.archiveSupplier(owner, settledVendor.id, {
      idempotencyKey: key(),
    });
    expect(archived.supplier.status).toBe("archived");
    await expect(
      repository.createPurchase(owner, creditPurchase(settledVendor.id)),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      repository.updateSupplier(owner, settledVendor.id, { idempotencyKey: key(), phone: "2222" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const updated = await repository.updateSupplier(owner, owedVendor.id, {
      idempotencyKey: key(),
      taxId: "0614-010101-101-1",
      creditDays: null,
    });
    expect(updated.supplier).toMatchObject({ taxId: "0614-010101-101-1", creditDays: null });
  });

  test("refuses a total of zero, a due date before the purchase and an archived product", async () => {
    const owner = actor("ownerA");
    const vendor = await newSupplier("Validaciones");
    await expect(
      repository.createPurchase(
        owner,
        creditPurchase(vendor.id, {
          lines: [{ productId: trackedId, quantityMinorUnits: "1", unitCostMinorUnits: "0" }],
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      repository.createPurchase(
        owner,
        creditPurchase(vendor.id, { dueDate: shiftDate(today, -5) }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const { product } = await catalog.createProduct(owner, {
      idempotencyKey: key(),
      name: `Descontinuado ${runId.slice(0, 8)}`,
      unitKind: "unit",
      quantityPrecision: 0,
      tracked: true,
      categoryId: null,
      sku: null,
      sellingPriceMinorUnits: null,
      lowStockThresholdMinorUnits: null,
    });
    await catalog.archiveProduct(owner, product.id, { idempotencyKey: key() });
    await expect(
      repository.createPurchase(
        owner,
        creditPurchase(vendor.id, {
          lines: [{ productId: product.id, quantityMinorUnits: "1", unitCostMinorUnits: "10" }],
        }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const stored = await database.db
      .select({ id: purchase.id })
      .from(purchase)
      .where(and(eq(purchase.businessId, businessA), eq(purchase.supplierId, vendor.id)));
    expect(stored).toEqual([]);
  });
});
