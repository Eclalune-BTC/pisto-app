import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";

import {
  createBusinessRepository,
  createCashRepository,
  createDatabase,
  createDebtorsRepository,
  createMoneyTrendRepository,
  createMovementsRepository,
  createSalesRepository,
  member,
  organization,
  parseDatabaseConfig,
  session,
  user,
} from "../src/index.ts";
import { createReceivablesRepository } from "../src/receivables.ts";
import { businessSettings } from "../src/schema/business.ts";
import { cashMovement, cashOperationReceipt, expense } from "../src/schema/cash.ts";
import { cashAccount } from "../src/schema/cash-account.ts";
import {
  customer,
  receivable,
  receivableOperation,
  receivablePayment,
} from "../src/schema/receivables.ts";
import { sale, saleCorrection, saleOperation } from "../src/schema/sales.ts";

const database = createDatabase({ ...parseDatabaseConfig(process.env), maxConnections: 8 });
const businesses = createBusinessRepository(database.db);
const sales = createSalesRepository(database.db);
const cash = createCashRepository(database.db);
const receivables = createReceivablesRepository(database.db);
const moneyTrend = createMoneyTrendRepository(database.db);
const movements = createMovementsRepository(database.db);
const debtors = createDebtorsRepository(database.db);

const runId = crypto.randomUUID();
const userIds = {
  ownerA: `ledger-owner-a-${runId}`,
  member: `ledger-member-${runId}`,
  ownerB: `ledger-owner-b-${runId}`,
};
const sessionIds = {
  ownerA: `ledger-session-owner-a-${runId}`,
  member: `ledger-session-member-${runId}`,
  ownerB: `ledger-session-owner-b-${runId}`,
};
const businessIds: string[] = [];
let businessA = "";
let businessB = "";
let tillId = "";
let bankId = "";
let foreignTillId = "";
let paymentId = "";
let reversedPaymentId = "";
let receivableId = "";

const actor = (name: keyof typeof userIds, businessId: string) => ({
  userId: userIds[name],
  sessionId: sessionIds[name],
  activeBusinessId: businessId,
});
const key = () => crypto.randomUUID();

/** The business-local date `daysAgo` days before now; El Salvador is UTC-6 all year. */
function localDate(daysAgo: number): string {
  return new Date(Date.now() - 6 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);
}
const at = (daysAgo: number, time: string) => ({
  occurredLocalDate: localDate(daysAgo),
  occurredLocalTime: time,
});

beforeAll(async () => {
  await database.db.insert(user).values(
    Object.entries(userIds).map(([name, id]) => ({
      id,
      name: `Ledger ${name}`,
      email: `ledger-${name}-${runId}@example.test`,
      emailVerified: true,
    })),
  );
  await database.db.insert(session).values(
    Object.entries(sessionIds).map(([name, id]) => ({
      id,
      token: `ledger-token-${name}-${runId}`,
      userId: userIds[name as keyof typeof userIds],
      expiresAt: new Date(Date.now() + 30 * 60_000),
    })),
  );
  const createdA = await businesses.createBusiness(actor("ownerA", ""), {
    name: `Ledger Store A ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  const createdB = await businesses.createBusiness(actor("ownerB", ""), {
    name: `Ledger Store B ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  businessA = createdA.business.id;
  businessB = createdB.business.id;
  businessIds.push(businessA, businessB);
  await database.db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: businessA,
    userId: userIds.member,
    role: "member",
  });
  await database.db
    .update(session)
    .set({ activeOrganizationId: businessA })
    .where(eq(session.id, sessionIds.member));

  const owner = actor("ownerA", businessA);
  const till = await cash.createAccount(owner, {
    idempotencyKey: key(),
    name: "Caja",
    kind: "cash",
    allowNegativeBalance: false,
    currency: "USD",
    opening: { direction: "in", amountMinorUnits: "10000", reason: "Fondo", ...at(40, "07:00") },
  });
  tillId = till.account.id;
  const bank = await cash.createAccount(owner, {
    idempotencyKey: key(),
    name: "Banco",
    kind: "bank",
    allowNegativeBalance: false,
    currency: "USD",
    opening: { direction: "in", amountMinorUnits: "50000", reason: "Saldo", ...at(3, "08:00") },
  });
  bankId = bank.account.id;
  const retired = await cash.createAccount(owner, {
    idempotencyKey: key(),
    name: "Retirada",
    kind: "other",
    allowNegativeBalance: true,
    currency: "USD",
    opening: null,
  });
  await cash.archiveAccount(owner, retired.account.id, { idempotencyKey: key() });

  await cash.postExpense(owner, {
    idempotencyKey: key(),
    accountId: tillId,
    category: "utilities",
    amountMinorUnits: "2500",
    currency: "USD",
    description: "Recibo de luz",
    payee: "CAESS",
    entrySource: "voice",
    ...at(2, "09:20"),
  });
  const voided = await cash.postExpense(owner, {
    idempotencyKey: key(),
    accountId: tillId,
    category: "other",
    amountMinorUnits: "900",
    currency: "USD",
    description: "Gasto anulado",
    ...at(2, "10:00"),
  });
  await cash.voidExpense(owner, voided.expense.id, {
    idempotencyKey: key(),
    reason: "Duplicado",
    ...at(2, "10:05"),
  });

  await sales.createSale(owner, {
    idempotencyKey: key(),
    grossMinorUnits: "1500",
    description: "Venta de mostrador",
    ...at(1, "08:00"),
  });
  const voidedSale = await sales.createSale(owner, {
    idempotencyKey: key(),
    grossMinorUnits: "700",
    description: "Venta anulada",
    ...at(1, "08:30"),
  });
  await sales.voidSale(owner, voidedSale.sale.id, { idempotencyKey: key(), reason: "Error" });

  const { customer: rosa } = await receivables.createCustomer(owner, {
    idempotencyKey: key(),
    name: "Rosa Ayala",
  });
  const { customer: pilar } = await receivables.createCustomer(owner, {
    idempotencyKey: key(),
    name: "Comedor El Pilar",
  });
  const posted = await receivables.postReceivable(owner, {
    idempotencyKey: key(),
    customerId: rosa.id,
    originalMinorUnits: "5000",
    description: "Venta al crédito",
    postedDate: localDate(20),
    dueDate: localDate(10),
  });
  receivableId = posted.receivable.id;
  await receivables.postReceivable(owner, {
    idempotencyKey: key(),
    customerId: pilar.id,
    originalMinorUnits: "9000",
    description: "Pedido semanal",
    postedDate: localDate(1),
    dueDate: localDate(-5),
  });
  const paid = await receivables.applyPayment(owner, receivableId, {
    idempotencyKey: key(),
    amountMinorUnits: "2000",
    cashAccountId: tillId,
    reference: "Abono en efectivo",
    entrySource: "text",
    ...at(1, "15:30"),
  });
  paymentId = paid.payment.id;
  const toReverse = await receivables.applyPayment(owner, receivableId, {
    idempotencyKey: key(),
    amountMinorUnits: "500",
    cashAccountId: tillId,
    ...at(1, "16:00"),
  });
  reversedPaymentId = toReverse.payment.id;
  await receivables.reversePayment(owner, reversedPaymentId, {
    idempotencyKey: key(),
    ...at(1, "16:10"),
  });

  const foreign = await cash.createAccount(actor("ownerB", businessB), {
    idempotencyKey: key(),
    name: "Caja B",
    kind: "cash",
    allowNegativeBalance: false,
    currency: "USD",
    opening: { direction: "in", amountMinorUnits: "77700", reason: "Fondo", ...at(1, "07:00") },
  });
  foreignTillId = foreign.account.id;
  await cash.postExpense(actor("ownerB", businessB), {
    idempotencyKey: key(),
    accountId: foreignTillId,
    category: "rent",
    amountMinorUnits: "1100",
    currency: "USD",
    description: "Recibo de luz ajeno",
    ...at(1, "09:00"),
  });
}, 30_000);

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

describe("money trend on PostgreSQL 18", () => {
  test("closes each business-local day across active accounts of one tenant", async () => {
    const trend = await moneyTrend.getMoneyTrend(actor("ownerA", businessA), { range: "7d" });
    // 10000 opening, -2500 luz (-900 voided and +900 reversed), +50000 bank, +2000 abono,
    // +500 abono and -500 reversal. Sales do not move cash.
    expect(trend.startLocalDate).toBe(localDate(6));
    expect(trend.endLocalDate).toBe(localDate(0));
    expect(trend.points).toHaveLength(7);
    expect(trend.openingMinorUnits).toBe("10000");
    expect(trend.closingMinorUnits).toBe("59500");
    expect(trend.changeMinorUnits).toBe("49500");
    expect(trend.points.at(-1)?.closingMinorUnits).toBe("59500");
    expect(trend.points.find((point) => point.localDate === localDate(3))?.closingMinorUnits).toBe(
      "60000",
    );
    expect(trend.points.find((point) => point.localDate === localDate(2))?.closingMinorUnits).toBe(
      "57500",
    );
    expect(trend.kinds).toEqual([
      { kind: "cash", accountCount: "1", balanceMinorUnits: "9500" },
      { kind: "bank", accountCount: "1", balanceMinorUnits: "50000" },
    ]);
    expect(trend.activeAccountCount).toBe("2");
  });

  test("spans six calendar months and thirty days inclusive", async () => {
    const thirty = await moneyTrend.getMoneyTrend(actor("ownerA", businessA), { range: "30d" });
    expect(thirty.points).toHaveLength(30);
    expect(thirty.openingMinorUnits).toBe("10000");
    const six = await moneyTrend.getMoneyTrend(actor("ownerA", businessA), { range: "6m" });
    expect(six.points.length).toBeGreaterThanOrEqual(181);
    expect(six.points.length).toBeLessThanOrEqual(185);
    expect(six.openingMinorUnits).toBe("0");
    expect(six.closingMinorUnits).toBe("59500");
  });

  test("denies a seller without cash access", async () => {
    await expect(
      moneyTrend.getMoneyTrend(actor("member", businessA), { range: "7d" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("movements ledger on PostgreSQL 18", () => {
  const period = { startLocalDate: localDate(30), endLocalDate: localDate(0) };

  test("unions standing sales, expenses and abonos newest first with exact totals", async () => {
    const list = await movements.listMovements(actor("ownerA", businessA), period);
    expect(list.items.map((item) => [item.kind, item.amountMinorUnits, item.entrySource])).toEqual([
      ["receivable_payment", "2000", "text"],
      ["sale", "1500", "manual"],
      ["expense", "-2500", "voice"],
    ]);
    const [abono, venta, luz] = list.items;
    expect(abono?.recordId).toBe(paymentId);
    expect(abono?.parentRecordId).toBe(receivableId);
    expect(abono?.accountName).toBe("Caja");
    expect(abono?.facts).toMatchObject({
      counterpartyName: "Rosa Ayala",
      description: "Venta al crédito",
      reference: "Abono en efectivo",
    });
    expect(venta?.accountId).toBeNull();
    expect(luz?.facts).toMatchObject({ expenseCategory: "utilities", counterpartyName: "CAESS" });
    expect(list.items.map((item) => item.recordId)).not.toContain(reversedPaymentId);
    expect(list.totals).toEqual({
      inflowMinorUnits: "3500",
      outflowMinorUnits: "2500",
      netMinorUnits: "1000",
    });
    expect(list.days).toEqual([
      {
        localDate: localDate(1),
        inflowMinorUnits: "3500",
        outflowMinorUnits: "0",
        netMinorUnits: "3500",
      },
      {
        localDate: localDate(2),
        inflowMinorUnits: "0",
        outflowMinorUnits: "2500",
        netMinorUnits: "-2500",
      },
    ]);
  });

  test("pages with a cursor bound to its filters and keeps whole-period totals", async () => {
    const first = await movements.listMovements(actor("ownerA", businessA), {
      ...period,
      limit: 2,
    });
    expect(first.items).toHaveLength(2);
    expect(first.totals.netMinorUnits).toBe("1000");
    expect(first.nextCursor).not.toBeNull();
    const second = await movements.listMovements(actor("ownerA", businessA), {
      ...period,
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.map((item) => item.kind)).toEqual(["expense"]);
    expect(second.nextCursor).toBeNull();
    await expect(
      movements.listMovements(actor("ownerA", businessA), {
        ...period,
        kind: "sale",
        cursor: first.nextCursor ?? undefined,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("filters by kind, account and escaped search text", async () => {
    const owner = actor("ownerA", businessA);
    const expenses = await movements.listMovements(owner, { ...period, kind: "expense" });
    expect(expenses.items.map((item) => item.kind)).toEqual(["expense"]);
    expect(expenses.totals.inflowMinorUnits).toBe("0");
    const bank = await movements.listMovements(owner, { ...period, accountId: bankId });
    expect(bank.items).toEqual([]);
    const till = await movements.listMovements(owner, { ...period, accountId: tillId });
    expect(till.items.map((item) => item.kind)).toEqual(["receivable_payment", "expense"]);
    const search = await movements.listMovements(owner, { ...period, query: "luz" });
    expect(search.items.map((item) => item.facts.description)).toEqual(["Recibo de luz"]);
    const wildcard = await movements.listMovements(owner, { ...period, query: "%" });
    expect(wildcard.items).toEqual([]);
  });

  test("keeps tenants apart and denies a seller", async () => {
    const foreign = await movements.listMovements(actor("ownerA", businessA), {
      ...period,
      accountId: foreignTillId,
    });
    expect(foreign.items).toEqual([]);
    const other = await movements.listMovements(actor("ownerB", businessB), period);
    expect(other.items.map((item) => item.facts.description)).toEqual(["Recibo de luz ajeno"]);
    await expect(movements.listMovements(actor("member", businessA), period)).rejects.toMatchObject(
      {
        code: "FORBIDDEN",
      },
    );
  });
});

describe("debtors on PostgreSQL 18", () => {
  test("lists customers with open balances, overdue first", async () => {
    const result = await debtors.getDebtors(actor("ownerA", businessA));
    expect(result.customerCount).toBe("2");
    expect(result.businessLocalDate).toBe(localDate(0));
    expect(
      result.items.map((item) => [
        item.customerName,
        item.outstandingMinorUnits,
        item.overdueMinorUnits,
        item.overdueSinceLocalDate,
        item.nextDueLocalDate,
      ]),
    ).toEqual([
      ["Rosa Ayala", "3000", "3000", localDate(10), null],
      ["Comedor El Pilar", "9000", "0", null, localDate(-5)],
    ]);
    const other = await debtors.getDebtors(actor("ownerB", businessB));
    expect(other.items).toEqual([]);
    expect(other.customerCount).toBe("0");
    await expect(debtors.getDebtors(actor("member", businessA))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
