import type {
  CashAccount,
  CashAccountCommandResult,
  CashAccountList,
  CashAccountListQuery,
  CashMovementCommandResult,
  CashMovementList,
  CashMovementListQuery,
  CashTransferCommandResult,
  CreateCashAccountRequest,
  Expense,
  ExpenseCommandResult,
  ExpenseList,
  ExpenseListQuery,
  ExpensePeriodQuery,
  ExpensePeriodSummary,
  PostExpenseRequest,
  RecordCashAdjustmentRequest,
  ReverseCashMovementRequest,
  TransferCashRequest,
  UpdateCashAccountRequest,
  VoidExpenseRequest,
} from "../../../contracts/src/cash.ts";

import type { Database } from "../client.ts";
import type { ProductActor } from "../product.ts";
import type { cashAccount, cashMovement, cashTransfer, expense } from "../schema/cash.ts";

export type CashOperationAction =
  | "cash_account.create"
  | "cash_account.update"
  | "cash_account.archive"
  | "expense.post"
  | "expense.void"
  | "cash.adjust"
  | "cash.reverse"
  | "cash.transfer";

export type CashTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type CashAccountRecord = typeof cashAccount.$inferSelect;
export type CashMovementRecord = typeof cashMovement.$inferSelect;
export type CashTransferRecord = typeof cashTransfer.$inferSelect;
export type ExpenseRecord = typeof expense.$inferSelect;

export type AuthorizedBusiness = {
  businessId: string;
  currency: string;
  currencyMinorUnitDigits: number;
  queriedAt: Date;
  role: string;
  timeZone: string;
};

export type CashCursorPayload = { createdAt: string; id: string };

export interface CashRepository {
  createAccount(
    actor: ProductActor,
    command: CreateCashAccountRequest,
  ): Promise<CashAccountCommandResult>;
  updateAccount(
    actor: ProductActor,
    accountId: string,
    command: UpdateCashAccountRequest,
  ): Promise<CashAccountCommandResult>;
  archiveAccount(
    actor: ProductActor,
    accountId: string,
    command: { idempotencyKey: string },
  ): Promise<CashAccountCommandResult>;
  getAccount(actor: ProductActor, accountId: string): Promise<CashAccount>;
  listAccounts(actor: ProductActor, query: CashAccountListQuery): Promise<CashAccountList>;
  postExpense(actor: ProductActor, command: PostExpenseRequest): Promise<ExpenseCommandResult>;
  voidExpense(
    actor: ProductActor,
    expenseId: string,
    command: VoidExpenseRequest,
  ): Promise<ExpenseCommandResult>;
  getExpense(actor: ProductActor, expenseId: string): Promise<Expense>;
  listExpenses(actor: ProductActor, query: ExpenseListQuery): Promise<ExpenseList>;
  getExpensePeriodSummary(
    actor: ProductActor,
    query: ExpensePeriodQuery,
  ): Promise<ExpensePeriodSummary>;
  recordAdjustment(
    actor: ProductActor,
    command: RecordCashAdjustmentRequest,
  ): Promise<CashMovementCommandResult>;
  reverseAdjustment(
    actor: ProductActor,
    movementId: string,
    command: ReverseCashMovementRequest,
  ): Promise<CashMovementCommandResult>;
  transfer(actor: ProductActor, command: TransferCashRequest): Promise<CashTransferCommandResult>;
  listMovements(actor: ProductActor, query: CashMovementListQuery): Promise<CashMovementList>;
}
