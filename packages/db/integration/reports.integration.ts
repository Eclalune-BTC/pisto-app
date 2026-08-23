import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";

import { authorizeBusinessAction } from "../src/business-access.ts";
import {
  createCashRepository,
  createCatalogRepository,
  createDatabase,
  createProductRepository,
  member,
  organization,
  parseDatabaseConfig,
  session,
  user,
} from "../src/index.ts";
import { createReceivablesRepository } from "../src/receivables.ts";
import { createReportsRepository, REPORT_TRANSACTION_CONFIG } from "../src/reports.ts";
import { businessSettings } from "../src/schema/business.ts";
import { cashMovement, cashOperationReceipt, expense } from "../src/schema/cash.ts";
import { cashAccount } from "../src/schema/cash-account.ts";
import { catalogOperation, catalogProduct, inventoryMovement } from "../src/schema/catalog.ts";
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
const repository = createReportsRepository(database.db);

const runId = crypto.randomUUID();
const userIds = {
  admin: `reports-admin-${runId}`,
  member: `reports-member-${runId}`,
  ownerA: `reports-owner-a-${runId}`,
  ownerB: `reports-owner-b-${runId}`,
  ownerEmpty: `reports-owner-empty-${runId}`,
};
const sessionIds = {
  admin: `reports-session-admin-${runId}`,
  member: `reports-session-member-${runId}`,
  ownerA: `reports-session-owner-a-${runId}`,
  ownerB: `reports-session-owner-b-${runId}`,
  ownerEmpty: `reports-session-owner-empty-${runId}`,
};

const businessIds: string[] = [];
let businessA = "";
let businessB = "";
let businessEmpty = "";
let activeAccountId = "";
let archivedAccountId = "";
let foreignAccountId = "";

const marchRange = { startLocalDate: "2026-03-01", endLocalDate: "2026-03-31" };

const actor = (key: keyof typeof userIds, businessId: string) => ({
  userId: userIds[key],
  sessionId: sessionIds[key],
  activeBusinessId: businessId,
});

const key = () => crypto.randomUUID();

async function seedBusinessA(): Promise<void> {
  const owner = actor("ownerA", businessA);

  const account = await cash.createAccount(owner, {
    idempotencyKey: key(),
    name: "Caja principal",
    kind: "cash",
    allowNegativeBalance: true,
    currency: "USD",
    opening: null,
  });
  activeAccountId = account.account.id;
  const retired = await cash.createAccount(owner, {
    idempotencyKey: key(),
    name: "Zeta banco retirado",
    kind: "bank",
    allowNegativeBalance: true,
    currency: "USD",
    opening: null,
  });
  archivedAccountId = retired.account.id;
  await cash.archiveAccount(owner, archivedAccountId, { idempotencyKey: key() });

  await product.createSale(owner, {
    idempotencyKey: key(),
    grossMinorUnits: "10000",
    occurredLocalDate: "2026-03-01",
    occurredLocalTime: "00:00",
  });
  await product.createSale(owner, {
    idempotencyKey: key(),
    grossMinorUnits: "2500",
    occurredLocalDate: "2026-03-31",
    occurredLocalTime: "23:00",
  });
  await product.createSale(owner, {
    idempotencyKey: key(),
    grossMinorUnits: "700",
    occurredLocalDate: "2026-04-01",
    occurredLocalTime: "00:00",
  });
  await product.createSale(owner, {
    idempotencyKey: key(),
    grossMinorUnits: "300",
    occurredLocalDate: "2026-02-28",
    occurredLocalTime: "23:00",
  });
  const voidedSale = await product.createSale(owner, {
    idempotencyKey: key(),
    grossMinorUnits: "5000",
    occurredLocalDate: "2026-03-15",
    occurredLocalTime: "12:00",
  });
  await product.voidSale(owner, voidedSale.sale.id, {
    idempotencyKey: key(),
    reason: "Duplicated ticket",
  });

  await cash.recordAdjustment(owner, {
    idempotencyKey: key(),
    accountId: activeAccountId,
    direction: "in",
    amountMinorUnits: "5000",
    currency: "USD",
    reason: "Counted cash",
    occurredLocalDate: "2026-03-05",
    occurredLocalTime: "09:00",
  });
  await cash.recordAdjustment(owner, {
    idempotencyKey: key(),
    accountId: activeAccountId,
    direction: "out",
    amountMinorUnits: "1200",
    currency: "USD",
    reason: "Counted shortage",
    occurredLocalDate: "2026-03-06",
    occurredLocalTime: "10:00",
  });
  await cash.recordAdjustment(owner, {
    idempotencyKey: key(),
    accountId: activeAccountId,
    direction: "in",
    amountMinorUnits: "9999",
    currency: "USD",
    reason: "Outside the reported period",
    occurredLocalDate: "2026-04-02",
    occurredLocalTime: "09:00",
  });

  await cash.postExpense(owner, {
    idempotencyKey: key(),
    accountId: activeAccountId,
    category: "rent",
    amountMinorUnits: "700",
    currency: "USD",
    description: "March rent",
    payee: "Landlord",
    occurredLocalDate: "2026-03-07",
    occurredLocalTime: "11:00",
  });
  await cash.postExpense(owner, {
    idempotencyKey: key(),
    accountId: activeAccountId,
    category: "other",
    amountMinorUnits: "300",
    currency: "USD",
    description: "Cleaning supplies",
    occurredLocalDate: "2026-03-08",
    occurredLocalTime: "12:00",
  });
  const voidedExpense = await cash.postExpense(owner, {
    idempotencyKey: key(),
    accountId: activeAccountId,
    category: "transport",
    amountMinorUnits: "400",
    currency: "USD",
    description: "Delivery that never happened",
    occurredLocalDate: "2026-03-09",
    occurredLocalTime: "13:00",
  });
  await cash.voidExpense(owner, voidedExpense.expense.id, {
    idempotencyKey: key(),
    reason: "Delivery was cancelled",
    occurredLocalDate: "2026-03-09",
    occurredLocalTime: "14:00",
  });

  const stocked = await catalog.createProduct(owner, {
    idempotencyKey: key(),
    name: "Stocked product",
    quantityPrecision: 0,
    tracked: true,
    unitKind: "unit",
    lowStockThresholdMinorUnits: "5",
  });
  const low = await catalog.createProduct(owner, {
    idempotencyKey: key(),
    name: "Low product",
    quantityPrecision: 0,
    tracked: true,
    unitKind: "unit",
    lowStockThresholdMinorUnits: "5",
  });
  await catalog.createProduct(owner, {
    idempotencyKey: key(),
    name: "Tracked product without a threshold",
    quantityPrecision: 0,
    tracked: true,
    unitKind: "unit",
  });
  await catalog.createProduct(owner, {
    idempotencyKey: key(),
    name: "Service without stock",
    quantityPrecision: 0,
    tracked: false,
    unitKind: "unit",
  });
  await catalog.recordMovement(owner, stocked.product.id, {
    idempotencyKey: key(),
    action: "receive",
    quantityMinorUnits: "10",
    reason: "Opening stock",
    occurredLocalDate: "2026-03-02",
    occurredLocalTime: "08:00",
  });
  await catalog.recordMovement(owner, low.product.id, {
    idempotencyKey: key(),
    action: "receive",
    quantityMinorUnits: "3",
    reason: "Opening stock",
    occurredLocalDate: "2026-03-02",
    occurredLocalTime: "08:30",
  });

  const buyer = await receivables.createCustomer(owner, { idempotencyKey: key(), name: "Buyer A" });
  const overdue = await receivables.postReceivable(owner, {
    idempotencyKey: key(),
    customerId: buyer.customer.id,
    originalMinorUnits: "8000",
    description: "Overdue charge",
    postedDate: "2026-03-10",
    dueDate: "2026-03-20",
  });
  await receivables.applyPayment(owner, overdue.receivable.id, {
    idempotencyKey: key(),
    amountMinorUnits: "3000",
    occurredLocalDate: "2026-05-10",
    occurredLocalTime: "09:00",
    cashAccountId: activeAccountId,
  });
  await receivables.postReceivable(owner, {
    idempotencyKey: key(),
    customerId: buyer.customer.id,
    originalMinorUnits: "2000",
    description: "Open charge without a due date",
    postedDate: "2026-03-11",
  });
  const settled = await receivables.postReceivable(owner, {
    idempotencyKey: key(),
    customerId: buyer.customer.id,
    originalMinorUnits: "1000",
    description: "Settled charge",
    postedDate: "2026-03-12",
    dueDate: "2026-03-25",
  });
  await receivables.applyPayment(owner, settled.receivable.id, {
    idempotencyKey: key(),
    amountMinorUnits: "1000",
    occurredLocalDate: "2026-05-10",
    occurredLocalTime: "09:30",
    cashAccountId: activeAccountId,
  });
  const cancelled = await receivables.postReceivable(owner, {
    idempotencyKey: key(),
    customerId: buyer.customer.id,
    originalMinorUnits: "4000",
    description: "Cancelled charge",
    postedDate: "2026-03-13",
    dueDate: "2026-03-26",
  });
  await receivables.voidReceivable(owner, cancelled.receivable.id, {
    idempotencyKey: key(),
    reason: "Charged the wrong customer",
  });
}

async function seedBusinessB(): Promise<void> {
  const owner = actor("ownerB", businessB);
  const account = await cash.createAccount(owner, {
    idempotencyKey: key(),
    name: "Foreign tenant cash",
    kind: "cash",
    allowNegativeBalance: true,
    currency: "USD",
    opening: null,
  });
  foreignAccountId = account.account.id;
  await product.createSale(owner, {
    idempotencyKey: key(),
    grossMinorUnits: "999999",
    occurredLocalDate: "2026-03-15",
    occurredLocalTime: "12:00",
  });
  await cash.recordAdjustment(owner, {
    idempotencyKey: key(),
    accountId: foreignAccountId,
    direction: "in",
    amountMinorUnits: "888888",
    currency: "USD",
    reason: "Foreign tenant inflow",
    occurredLocalDate: "2026-03-15",
    occurredLocalTime: "12:30",
  });
  const stocked = await catalog.createProduct(owner, {
    idempotencyKey: key(),
    name: "Foreign tenant product",
    quantityPrecision: 0,
    tracked: true,
    unitKind: "unit",
    lowStockThresholdMinorUnits: "100",
  });
  await catalog.recordMovement(owner, stocked.product.id, {
    idempotencyKey: key(),
    action: "receive",
    quantityMinorUnits: "1",
    reason: "Opening stock",
    occurredLocalDate: "2026-03-02",
    occurredLocalTime: "08:00",
  });
  const buyer = await receivables.createCustomer(owner, { idempotencyKey: key(), name: "Buyer B" });
  await receivables.postReceivable(owner, {
    idempotencyKey: key(),
    customerId: buyer.customer.id,
    originalMinorUnits: "777777",
    description: "Foreign tenant charge",
    postedDate: "2026-03-10",
    dueDate: "2026-03-20",
  });
}

beforeAll(async () => {
  await database.db.insert(user).values(
    Object.entries(userIds).map(([name, id]) => ({
      id,
      name: `Reports ${name}`,
      email: `reports-${name}-${runId}@example.test`,
      emailVerified: true,
    })),
  );
  await database.db.insert(session).values(
    Object.entries(sessionIds).map(([name, id]) => ({
      id,
      token: `reports-token-${name}-${runId}`,
      userId: userIds[name as keyof typeof userIds],
      expiresAt: new Date(Date.now() + 30 * 60_000),
    })),
  );

  const createdA = await product.createBusiness(actor("ownerA", ""), {
    name: `Reports Store A ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  const createdB = await product.createBusiness(actor("ownerB", ""), {
    name: `Reports Store B ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  const createdEmpty = await product.createBusiness(actor("ownerEmpty", ""), {
    name: `Reports Store Empty ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  businessA = createdA.business.id;
  businessB = createdB.business.id;
  businessEmpty = createdEmpty.business.id;
  businessIds.push(businessA, businessB, businessEmpty);

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

  await seedBusinessA();
  await seedBusinessB();
});

afterAll(async () => {
  if (businessIds.length > 0) {
    await database.db.delete(cashMovement).where(inArray(cashMovement.businessId, businessIds));
    await database.db
      .delete(receivableOperation)
      .where(inArray(receivableOperation.businessId, businessIds));
    await database.db
      .delete(receivablePayment)
      .where(inArray(receivablePayment.businessId, businessIds));
    await database.db.delete(receivable).where(inArray(receivable.businessId, businessIds));
    await database.db.delete(customer).where(inArray(customer.businessId, businessIds));
    await database.db.delete(expense).where(inArray(expense.businessId, businessIds));
    await database.db
      .delete(cashOperationReceipt)
      .where(inArray(cashOperationReceipt.businessId, businessIds));
    await database.db.delete(cashAccount).where(inArray(cashAccount.businessId, businessIds));
    await database.db
      .delete(catalogOperation)
      .where(inArray(catalogOperation.businessId, businessIds));
    await database.db
      .delete(inventoryMovement)
      .where(inArray(inventoryMovement.businessId, businessIds));
    await database.db.delete(catalogProduct).where(inArray(catalogProduct.businessId, businessIds));
    await database.db.delete(saleCorrection).where(inArray(saleCorrection.businessId, businessIds));
    await database.db.delete(saleOperation).where(inArray(saleOperation.businessId, businessIds));
    await database.db.delete(sale).where(inArray(sale.businessId, businessIds));
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

describe("operating reports repository on PostgreSQL 18", () => {
  test("aggregates exact period facts and current position for one tenant", async () => {
    const report = await repository.getOperatingReport(actor("ownerA", businessA), marchRange);

    expect(report.period).toEqual({
      startLocalDate: "2026-03-01",
      endLocalDateInclusive: "2026-03-31",
      startUtc: "2026-03-01T06:00:00.000Z",
      endUtcExclusive: "2026-04-01T06:00:00.000Z",
      timeZone: "America/El_Salvador",
    });
    expect(report.currency).toBe("USD");
    expect(report.currencyMinorUnitDigits).toBe(2);

    expect(report.sales).toEqual({ grossMinorUnits: "12500", saleCount: "2" });

    expect(report.expenses).toEqual({
      totalMinorUnits: "1000",
      expenseCount: "2",
      categories: [
        { category: "rent", totalMinorUnits: "700", expenseCount: "1" },
        { category: "other", totalMinorUnits: "300", expenseCount: "1" },
      ],
    });

    expect(report.cash.inflowMinorUnits).toBe("5400");
    expect(report.cash.outflowMinorUnits).toBe("2600");
    expect(report.cash.netMovementMinorUnits).toBe("2800");
    expect(report.cash.accounts).toEqual([
      {
        accountId: activeAccountId,
        accountName: "Caja principal",
        accountKind: "cash",
        accountStatus: "active",
        inflowMinorUnits: "5400",
        outflowMinorUnits: "2600",
        netMovementMinorUnits: "2800",
      },
      {
        accountId: archivedAccountId,
        accountName: "Zeta banco retirado",
        accountKind: "bank",
        accountStatus: "archived",
        inflowMinorUnits: "0",
        outflowMinorUnits: "0",
        netMovementMinorUnits: "0",
      },
    ]);

    expect(report.inventory).toEqual({
      trackedProductCount: "3",
      lowStockProductCount: "1",
    });
    expect(report.receivables).toEqual({
      outstandingMinorUnits: "7000",
      overdueMinorUnits: "5000",
      openReceivableCount: "2",
      overdueReceivableCount: "1",
    });
  });

  test("resolves period boundaries in the business time zone, not in UTC", async () => {
    const april = await repository.getOperatingReport(actor("ownerA", businessA), {
      startLocalDate: "2026-04-01",
      endLocalDate: "2026-04-01",
    });
    const february = await repository.getOperatingReport(actor("ownerA", businessA), {
      startLocalDate: "2026-02-28",
      endLocalDate: "2026-02-28",
    });
    const lastMarchDay = await repository.getOperatingReport(actor("ownerA", businessA), {
      startLocalDate: "2026-03-31",
      endLocalDate: "2026-03-31",
    });

    // The 2026-03-31 23:00 local sale is 2026-04-01T05:00Z, so a UTC-day report
    // would move it into April and drop it from March.
    expect(lastMarchDay.sales).toEqual({ grossMinorUnits: "2500", saleCount: "1" });
    expect(april.sales).toEqual({ grossMinorUnits: "700", saleCount: "1" });
    expect(february.sales).toEqual({ grossMinorUnits: "300", saleCount: "1" });
    expect(april.period.startUtc).toBe("2026-04-01T06:00:00.000Z");
    expect(february.period.endUtcExclusive).toBe("2026-03-01T06:00:00.000Z");
  });

  test("never reports another tenant's records", async () => {
    const reportA = await repository.getOperatingReport(actor("ownerA", businessA), marchRange);
    const reportB = await repository.getOperatingReport(actor("ownerB", businessB), marchRange);

    expect(reportA.sales.grossMinorUnits).toBe("12500");
    expect(reportA.cash.accounts.map(({ accountId }) => accountId)).not.toContain(foreignAccountId);
    expect(reportA.receivables.outstandingMinorUnits).toBe("7000");

    expect(reportB.sales).toEqual({ grossMinorUnits: "999999", saleCount: "1" });
    expect(reportB.cash.accounts).toEqual([
      {
        accountId: foreignAccountId,
        accountName: "Foreign tenant cash",
        accountKind: "cash",
        accountStatus: "active",
        inflowMinorUnits: "888888",
        outflowMinorUnits: "0",
        netMovementMinorUnits: "888888",
      },
    ]);
    expect(reportB.inventory).toEqual({
      trackedProductCount: "1",
      lowStockProductCount: "1",
    });
    expect(reportB.receivables.outstandingMinorUnits).toBe("777777");
  });

  test("returns real zeros for a business that has no records", async () => {
    const report = await repository.getOperatingReport(
      actor("ownerEmpty", businessEmpty),
      marchRange,
    );

    expect(report.sales).toEqual({ grossMinorUnits: "0", saleCount: "0" });
    expect(report.expenses).toEqual({
      totalMinorUnits: "0",
      expenseCount: "0",
      categories: [],
    });
    expect(report.cash).toEqual({
      inflowMinorUnits: "0",
      outflowMinorUnits: "0",
      netMovementMinorUnits: "0",
      accounts: [],
    });
    expect(report.inventory).toEqual({
      trackedProductCount: "0",
      lowStockProductCount: "0",
    });
    expect(report.receivables).toEqual({
      outstandingMinorUnits: "0",
      overdueMinorUnits: "0",
      openReceivableCount: "0",
      overdueReceivableCount: "0",
    });
  });

  test("grants the report to owner and admin and denies it to member", async () => {
    const adminReport = await repository.getOperatingReport(actor("admin", businessA), marchRange);
    expect(adminReport.sales.grossMinorUnits).toBe("12500");

    await expect(
      repository.getOperatingReport(actor("member", businessA), marchRange),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // The tenant comes from the stored session, so another tenant's owner cannot
    // reach this business by supplying its identifier.
    await expect(
      repository.getOperatingReport(actor("ownerB", businessA), marchRange),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      repository.getOperatingReport(
        { ...actor("ownerA", businessA), activeBusinessId: null },
        {
          ...marchRange,
        },
      ),
    ).rejects.toMatchObject({ code: "BUSINESS_REQUIRED" });
  });

  test("rejects a range the contract does not accept before querying", async () => {
    await expect(
      repository.getOperatingReport(actor("ownerA", businessA), {
        startLocalDate: "2026-02-30",
        endLocalDate: "2026-03-01",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      repository.getOperatingReport(actor("ownerA", businessA), {
        startLocalDate: "2026-03-02",
        endLocalDate: "2026-03-01",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("cannot take a row lock inside the read-only report transaction", async () => {
    const authorized = await database.db.transaction(
      async (tx) =>
        authorizeBusinessAction(tx, actor("ownerA", businessA), ["reports:read"], "none"),
      REPORT_TRANSACTION_CONFIG,
    );
    expect(authorized.businessId).toBe(businessA);

    const failure = await database.db
      .transaction(
        async (tx) =>
          authorizeBusinessAction(tx, actor("ownerA", businessA), ["reports:read"], "share"),
        REPORT_TRANSACTION_CONFIG,
      )
      .then(
        () => null,
        (error: { cause?: { code?: string } }) => error,
      );
    expect(failure?.cause?.code).toBe("25006");
  });

  test("keeps serving the snapshot while the session row is concurrently updated", async () => {
    let updating = true;
    const churn = (async () => {
      while (updating) {
        await database.db
          .update(session)
          .set({ updatedAt: new Date() })
          .where(eq(session.id, sessionIds.ownerA));
        await Bun.sleep(1);
      }
    })();

    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const report = await repository.getOperatingReport(actor("ownerA", businessA), marchRange);
        expect(report.sales.grossMinorUnits).toBe("12500");
      }
    } finally {
      updating = false;
      await churn;
    }
  });

  test("fails loudly instead of reporting a negative outstanding balance", async () => {
    const buyer = await receivables.createCustomer(actor("ownerA", businessA), {
      idempotencyKey: key(),
      name: "Invariant buyer",
    });
    const charge = await receivables.postReceivable(actor("ownerA", businessA), {
      idempotencyKey: key(),
      customerId: buyer.customer.id,
      originalMinorUnits: "500",
      description: "Charge whose ledger is corrupted below",
      postedDate: "2026-03-14",
    });
    await database.db.insert(receivablePayment).values({
      businessId: businessA,
      receivableId: charge.receivable.id,
      customerId: buyer.customer.id,
      kind: "payment",
      amountMinorUnits: 900n,
      currency: "USD",
      currencyMinorUnitDigits: 2,
      occurredAt: new Date("2026-03-14T18:00:00.000Z"),
      occurredLocalDate: "2026-03-14",
      occurredLocalTime: "12:00",
      timeZone: "America/El_Salvador",
      cashAccountId: activeAccountId,
      createdByUserId: userIds.ownerA,
    });

    try {
      await expect(
        repository.getOperatingReport(actor("ownerA", businessA), marchRange),
      ).rejects.toThrow("outstanding balance invariant");
    } finally {
      await database.db
        .delete(receivableOperation)
        .where(eq(receivableOperation.customerId, buyer.customer.id));
      await database.db
        .delete(receivablePayment)
        .where(eq(receivablePayment.receivableId, charge.receivable.id));
      await database.db.delete(receivable).where(eq(receivable.id, charge.receivable.id));
      await database.db.delete(customer).where(eq(customer.id, buyer.customer.id));
    }
  });
});
