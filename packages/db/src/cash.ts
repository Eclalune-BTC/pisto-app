import {
  archiveCashAccount,
  createCashAccount,
  updateCashAccount,
} from "./cash/account-commands.ts";
import { postPaidExpense, voidPaidExpense } from "./cash/expense-commands.ts";
import {
  recordCashAdjustment,
  reverseCashAdjustment,
  transferCash,
} from "./cash/movement-commands.ts";
import {
  getCashAccount,
  getExpense,
  getExpensePeriodSummary,
  listCashAccounts,
  listCashMovements,
  listExpenses,
} from "./cash/queries.ts";
import type { CashRepository } from "./cash/types.ts";
import type { Database } from "./client.ts";

export {
  decodeCashCursor,
  encodeCashCursor,
  fingerprintCashCommand,
  nextCalendarDate,
  parseCashMinorUnits,
} from "./cash/codec.ts";
export type { CashRepository } from "./cash/types.ts";

export function createCashRepository(db: Database): CashRepository {
  return {
    createAccount: (actor, command) => createCashAccount(db, actor, command),
    updateAccount: (actor, accountId, command) => updateCashAccount(db, actor, accountId, command),
    archiveAccount: (actor, accountId, command) =>
      archiveCashAccount(db, actor, accountId, command),
    getAccount: (actor, accountId) => getCashAccount(db, actor, accountId),
    listAccounts: (actor, query) => listCashAccounts(db, actor, query),
    postExpense: (actor, command) => postPaidExpense(db, actor, command),
    voidExpense: (actor, expenseId, command) => voidPaidExpense(db, actor, expenseId, command),
    getExpense: (actor, expenseId) => getExpense(db, actor, expenseId),
    listExpenses: (actor, query) => listExpenses(db, actor, query),
    getExpensePeriodSummary: (actor, query) => getExpensePeriodSummary(db, actor, query),
    recordAdjustment: (actor, command) => recordCashAdjustment(db, actor, command),
    reverseAdjustment: (actor, movementId, command) =>
      reverseCashAdjustment(db, actor, movementId, command),
    transfer: (actor, command) => transferCash(db, actor, command),
    listMovements: (actor, query) => listCashMovements(db, actor, query),
  };
}
