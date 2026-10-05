import {
  cashAccountListQuerySchema,
  cashMovementListQuerySchema,
  expenseCategorySchema,
  expenseListQuerySchema,
  expensePeriodQuerySchema,
} from "@pisto/contracts";
import { and, desc, eq, getTableColumns, gte, lt, sql } from "drizzle-orm";

import { authorizeBusinessAction } from "../business-access.ts";
import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import { nextCalendarDate, resolveLocalDateTime } from "../local-time.ts";
import {
  decodeCursor,
  decodeOccurrenceCursor,
  exactCursorTimestamp,
  keysetBefore,
  listFilterFingerprint,
  occurrenceKeysetBefore,
  pageOccurrenceRows,
  pageRows,
} from "../pagination.ts";
import { cashAccount, cashMovement, expense } from "../schema/cash.ts";
import { toCashAccount, toCashMovement, toExpense } from "./mappers.ts";
import { accountBalanceText } from "./records.ts";
import type { CashRepository } from "./types.ts";

type CashQueries = Pick<
  CashRepository,
  | "getAccount"
  | "getExpense"
  | "getExpensePeriodSummary"
  | "listAccounts"
  | "listExpenses"
  | "listMovements"
>;

export function createCashQueries(db: Database): CashQueries {
  return {
    async getAccount(actor, accountId) {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["cash:read"]);
        const [row] = await tx
          .select({ record: cashAccount, balanceMinorUnits: accountBalanceText() })
          .from(cashAccount)
          .where(and(eq(cashAccount.businessId, access.businessId), eq(cashAccount.id, accountId)))
          .limit(1);
        if (!row) throw new ProductError("NOT_FOUND", "Cash account was not found");
        return toCashAccount(row.record, row.balanceMinorUnits);
      });
    },

    async listAccounts(actor, rawQuery) {
      const query = parseInput(
        cashAccountListQuerySchema,
        rawQuery,
        "Account list query is invalid",
      );
      const filterFingerprint = await listFilterFingerprint("cash-accounts", {
        status: query.status,
      });
      const cursor = decodeCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["cash:read"]);
        const rows = await tx
          .select({
            record: cashAccount,
            id: cashAccount.id,
            createdAtExact: exactCursorTimestamp(cashAccount.createdAt),
            balanceMinorUnits: accountBalanceText(),
          })
          .from(cashAccount)
          .where(
            and(
              eq(cashAccount.businessId, access.businessId),
              query.status === "all" ? undefined : eq(cashAccount.status, query.status),
              keysetBefore(cashAccount, cursor),
            ),
          )
          .orderBy(desc(cashAccount.createdAt), desc(cashAccount.id))
          .limit(query.limit + 1);
        const page = pageRows(rows, query.limit, filterFingerprint);
        return {
          items: page.rows.map(({ record, balanceMinorUnits }) =>
            toCashAccount(record, balanceMinorUnits),
          ),
          nextCursor: page.nextCursor,
          queriedAt: access.queriedAt.toISOString(),
        };
      });
    },

    async getExpense(actor, expenseId) {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["expenses:read"]);
        const [record] = await tx
          .select()
          .from(expense)
          .where(and(eq(expense.businessId, access.businessId), eq(expense.id, expenseId)))
          .limit(1);
        if (!record) throw new ProductError("NOT_FOUND", "Expense was not found");
        return toExpense(record);
      });
    },

    async listExpenses(actor, rawQuery) {
      const query = parseInput(expenseListQuerySchema, rawQuery, "Expense list query is invalid");
      const filterFingerprint = await listFilterFingerprint("expenses", {
        accountId: query.accountId ?? null,
        category: query.category ?? null,
        status: query.status,
      });
      const cursor = decodeOccurrenceCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["expenses:read"]);
        const rows = await tx
          .select({
            ...getTableColumns(expense),
            occurredAtExact: exactCursorTimestamp(expense.occurredAt),
            createdAtExact: exactCursorTimestamp(expense.createdAt),
          })
          .from(expense)
          .where(
            and(
              eq(expense.businessId, access.businessId),
              query.status === "all" ? undefined : eq(expense.status, query.status),
              query.category ? eq(expense.category, query.category) : undefined,
              query.accountId ? eq(expense.accountId, query.accountId) : undefined,
              occurrenceKeysetBefore(expense, cursor),
            ),
          )
          .orderBy(desc(expense.occurredAt), desc(expense.createdAt), desc(expense.id))
          .limit(query.limit + 1);
        const page = pageOccurrenceRows(rows, query.limit, filterFingerprint);
        return {
          items: page.rows.map(toExpense),
          nextCursor: page.nextCursor,
          queriedAt: access.queriedAt.toISOString(),
        };
      });
    },

    async getExpensePeriodSummary(actor, rawQuery) {
      const query = parseInput(expensePeriodQuerySchema, rawQuery, "Expense period is invalid");
      if (query.startLocalDate > query.endLocalDate) {
        throw new ProductError("VALIDATION_ERROR", "Expense period start must not follow its end");
      }
      const endExclusiveLocal = nextCalendarDate(query.endLocalDate);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["expenses:read"]);
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
            category: expenseCategorySchema.parse(row.category),
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
    },

    async listMovements(actor, rawQuery) {
      const query = parseInput(
        cashMovementListQuerySchema,
        rawQuery,
        "Cash movement list query is invalid",
      );
      const filterFingerprint = await listFilterFingerprint("cash-movements", {
        accountId: query.accountId ?? null,
      });
      const cursor = decodeOccurrenceCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["cash:read"]);
        const rows = await tx
          .select({
            ...getTableColumns(cashMovement),
            occurredAtExact: exactCursorTimestamp(cashMovement.occurredAt),
            createdAtExact: exactCursorTimestamp(cashMovement.createdAt),
          })
          .from(cashMovement)
          .where(
            and(
              eq(cashMovement.businessId, access.businessId),
              query.accountId ? eq(cashMovement.accountId, query.accountId) : undefined,
              occurrenceKeysetBefore(cashMovement, cursor),
            ),
          )
          .orderBy(
            desc(cashMovement.occurredAt),
            desc(cashMovement.createdAt),
            desc(cashMovement.id),
          )
          .limit(query.limit + 1);
        const page = pageOccurrenceRows(rows, query.limit, filterFingerprint);
        return {
          items: page.rows.map(toCashMovement),
          nextCursor: page.nextCursor,
          queriedAt: access.queriedAt.toISOString(),
        };
      });
    },
  };
}
