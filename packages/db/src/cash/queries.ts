import {
  type CashAccount,
  type CashAccountList,
  type CashAccountListQuery,
  type CashMovementList,
  type CashMovementListQuery,
  cashAccountListQuerySchema,
  cashMovementListQuerySchema,
  type Expense,
  type ExpenseList,
  type ExpenseListQuery,
  type ExpensePeriodQuery,
  type ExpensePeriodSummary,
  expenseListQuerySchema,
  expensePeriodQuerySchema,
} from "@pisto/contracts";
import { and, desc, eq, getTableName, gte, lt, or, type SQL, sql } from "drizzle-orm";

import type { Database } from "../client.ts";
import { type ProductActor, ProductError, resolveLocalDateTime } from "../product.ts";
import { cashAccount, cashMovement, expense } from "../schema/cash.ts";

/**
 * A column reference inside a select projection renders without its table, so a
 * correlated subquery binds it to its own table and silently matches nothing.
 */
const accountTable = sql.identifier(getTableName(cashAccount));

import { requireAccess } from "./access.ts";
import { decodeCashCursor, encodeCashCursor, isCashResourceId, nextCalendarDate } from "./codec.ts";
import { toCashAccount, toCashMovement, toExpense } from "./mappers.ts";
import type { CashCursorPayload } from "./types.ts";

function cursorCondition(
  createdAtColumn:
    | typeof cashAccount.createdAt
    | typeof expense.createdAt
    | typeof cashMovement.createdAt,
  idColumn: typeof cashAccount.id | typeof expense.id | typeof cashMovement.id,
  cursor: CashCursorPayload,
): SQL {
  const date = new Date(cursor.createdAt);
  return or(
    lt(createdAtColumn, date),
    and(eq(createdAtColumn, date), lt(idColumn, cursor.id)),
  ) as SQL;
}

export async function getCashAccount(
  db: Database,
  actor: ProductActor,
  accountId: string,
): Promise<CashAccount> {
  if (!isCashResourceId(accountId)) {
    throw new ProductError("NOT_FOUND", "Cash account was not found");
  }
  return db.transaction(async (tx) => {
    const access = await requireAccess(tx, actor, ["cash:read"]);
    const [row] = await tx
      .select({
        record: cashAccount,
        balanceMinorUnits: sql<string>`coalesce(sum(${cashMovement.deltaMinorUnits}), 0)::text`,
      })
      .from(cashAccount)
      .leftJoin(
        cashMovement,
        and(
          eq(cashMovement.businessId, cashAccount.businessId),
          eq(cashMovement.accountId, cashAccount.id),
        ),
      )
      .where(and(eq(cashAccount.businessId, access.businessId), eq(cashAccount.id, accountId)))
      .groupBy(cashAccount.id)
      .limit(1);
    if (!row) throw new ProductError("NOT_FOUND", "Cash account was not found");
    return toCashAccount(row.record, row.balanceMinorUnits);
  });
}

export async function listCashAccounts(
  db: Database,
  actor: ProductActor,
  rawQuery: CashAccountListQuery,
): Promise<CashAccountList> {
  const parsed = cashAccountListQuerySchema.safeParse(rawQuery);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Account list query is invalid");
  const query = parsed.data;
  return db.transaction(async (tx) => {
    const access = await requireAccess(tx, actor, ["cash:read"]);
    const conditions: SQL[] = [eq(cashAccount.businessId, access.businessId)];
    if (query.status !== "all") conditions.push(eq(cashAccount.status, query.status));
    if (query.cursor) {
      conditions.push(
        cursorCondition(cashAccount.createdAt, cashAccount.id, decodeCashCursor(query.cursor)),
      );
    }
    const rows = await tx
      .select({
        record: cashAccount,
        balanceMinorUnits: sql<string>`coalesce((
          select sum(${cashMovement.deltaMinorUnits})
          from ${cashMovement}
          where ${cashMovement.businessId} = ${accountTable}.business_id
            and ${cashMovement.accountId} = ${accountTable}.id
        ), 0)::text`,
      })
      .from(cashAccount)
      .where(and(...conditions))
      .orderBy(desc(cashAccount.createdAt), desc(cashAccount.id))
      .limit(query.limit + 1);
    const visible = rows.slice(0, query.limit);
    const last = visible.at(-1)?.record;
    return {
      items: visible.map(({ record, balanceMinorUnits }) =>
        toCashAccount(record, balanceMinorUnits),
      ),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCashCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
      queriedAt: access.queriedAt.toISOString(),
    };
  });
}

export async function getExpense(
  db: Database,
  actor: ProductActor,
  expenseId: string,
): Promise<Expense> {
  if (!isCashResourceId(expenseId)) throw new ProductError("NOT_FOUND", "Expense was not found");
  return db.transaction(async (tx) => {
    const access = await requireAccess(tx, actor, ["expenses:read"]);
    const [record] = await tx
      .select()
      .from(expense)
      .where(and(eq(expense.businessId, access.businessId), eq(expense.id, expenseId)))
      .limit(1);
    if (!record) throw new ProductError("NOT_FOUND", "Expense was not found");
    return toExpense(record);
  });
}

export async function listExpenses(
  db: Database,
  actor: ProductActor,
  rawQuery: ExpenseListQuery,
): Promise<ExpenseList> {
  const parsed = expenseListQuerySchema.safeParse(rawQuery);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Expense list query is invalid");
  const query = parsed.data;
  return db.transaction(async (tx) => {
    const access = await requireAccess(tx, actor, ["expenses:read"]);
    const conditions: SQL[] = [eq(expense.businessId, access.businessId)];
    if (query.status !== "all") conditions.push(eq(expense.status, query.status));
    if (query.category) conditions.push(eq(expense.category, query.category));
    if (query.accountId) conditions.push(eq(expense.accountId, query.accountId));
    if (query.cursor) {
      conditions.push(
        cursorCondition(expense.createdAt, expense.id, decodeCashCursor(query.cursor)),
      );
    }
    const rows = await tx
      .select()
      .from(expense)
      .where(and(...conditions))
      .orderBy(desc(expense.createdAt), desc(expense.id))
      .limit(query.limit + 1);
    const visible = rows.slice(0, query.limit);
    const last = visible.at(-1);
    return {
      items: visible.map(toExpense),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCashCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
      queriedAt: access.queriedAt.toISOString(),
    };
  });
}

export async function getExpensePeriodSummary(
  db: Database,
  actor: ProductActor,
  rawQuery: ExpensePeriodQuery,
): Promise<ExpensePeriodSummary> {
  const parsed = expensePeriodQuerySchema.safeParse(rawQuery);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Expense period is invalid");
  const query = parsed.data;
  const endExclusiveLocal = nextCalendarDate(query.endLocalDate);
  nextCalendarDate(query.startLocalDate);
  if (query.startLocalDate > query.endLocalDate) {
    throw new ProductError("VALIDATION_ERROR", "Expense period start must not follow its end");
  }
  return db.transaction(async (tx) => {
    const access = await requireAccess(tx, actor, ["expenses:read"]);
    const periodStartUtc = resolveLocalDateTime({
      date: query.startLocalDate,
      time: "00:00",
      timeZone: access.timeZone,
    });
    const periodEndUtcExclusive = resolveLocalDateTime({
      date: endExclusiveLocal,
      time: "00:00",
      timeZone: access.timeZone,
    });
    const rows = await tx
      .select({
        category: expense.category,
        amountMinorUnits: sql<string>`sum(${expense.amountMinorUnits})::text`,
        expenseCount: sql<string>`count(${expense.id})::bigint::text`,
      })
      .from(expense)
      .where(
        and(
          eq(expense.businessId, access.businessId),
          eq(expense.status, "posted"),
          gte(expense.occurredAt, periodStartUtc),
          lt(expense.occurredAt, periodEndUtcExclusive),
        ),
      )
      .groupBy(expense.category)
      .orderBy(expense.category);
    let total = 0n;
    let count = 0n;
    const categories = rows.map((row) => {
      total += BigInt(row.amountMinorUnits);
      count += BigInt(row.expenseCount);
      return {
        category: row.category as Expense["category"],
        amountMinorUnits: row.amountMinorUnits,
        expenseCount: row.expenseCount,
      };
    });
    return {
      periodStartLocal: query.startLocalDate,
      periodEndLocalInclusive: query.endLocalDate,
      periodStartUtc: periodStartUtc.toISOString(),
      periodEndUtcExclusive: periodEndUtcExclusive.toISOString(),
      timeZone: access.timeZone,
      currency: access.currency,
      currencyMinorUnitDigits: access.currencyMinorUnitDigits,
      totalMinorUnits: total.toString(),
      expenseCount: count.toString(),
      categories,
      queriedAt: access.queriedAt.toISOString(),
    };
  });
}

export async function listCashMovements(
  db: Database,
  actor: ProductActor,
  rawQuery: CashMovementListQuery,
): Promise<CashMovementList> {
  const parsed = cashMovementListQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new ProductError("VALIDATION_ERROR", "Cash movement list query is invalid");
  }
  const query = parsed.data;
  return db.transaction(async (tx) => {
    const access = await requireAccess(tx, actor, ["cash:read"]);
    const conditions: SQL[] = [eq(cashMovement.businessId, access.businessId)];
    if (query.accountId) conditions.push(eq(cashMovement.accountId, query.accountId));
    if (query.cursor) {
      conditions.push(
        cursorCondition(cashMovement.createdAt, cashMovement.id, decodeCashCursor(query.cursor)),
      );
    }
    const rows = await tx
      .select()
      .from(cashMovement)
      .where(and(...conditions))
      .orderBy(desc(cashMovement.createdAt), desc(cashMovement.id))
      .limit(query.limit + 1);
    const visible = rows.slice(0, query.limit);
    const last = visible.at(-1);
    return {
      items: visible.map(toCashMovement),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCashCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
      queriedAt: access.queriedAt.toISOString(),
    };
  });
}
