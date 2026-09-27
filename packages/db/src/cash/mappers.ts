import type { CashAccount, CashMovement, CashTransfer, Expense } from "@pisto/contracts";
import {
  cashAccountKindSchema,
  cashAccountStatusSchema,
  cashMovementActionSchema,
  cashMovementDirectionSchema,
  expenseCategorySchema,
  expenseStatusSchema,
} from "@pisto/contracts";

import type {
  CashAccountRecord,
  CashMovementRecord,
  CashTransferRecord,
  ExpenseRecord,
} from "./types.ts";

export function toCashAccount(record: CashAccountRecord, balanceMinorUnits: string): CashAccount {
  return {
    id: record.id,
    name: record.name,
    kind: cashAccountKindSchema.parse(record.kind),
    status: cashAccountStatusSchema.parse(record.status),
    allowNegativeBalance: record.allowNegativeBalance,
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    balanceMinorUnits,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toCashMovement(record: CashMovementRecord): CashMovement {
  return {
    id: record.id,
    accountId: record.accountId,
    direction: cashMovementDirectionSchema.parse(record.direction),
    action: cashMovementActionSchema.parse(record.action),
    amountMinorUnits: record.amountMinorUnits.toString(),
    deltaMinorUnits: record.deltaMinorUnits.toString(),
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    occurredAt: record.occurredAt.toISOString(),
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    reason: record.reason,
    expenseId: record.expenseId,
    transferId: record.transferId,
    receivablePaymentId: record.receivablePaymentId,
    reversalOfMovementId: record.reversalOfMovementId,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toExpense(record: ExpenseRecord): Expense {
  return {
    id: record.id,
    accountId: record.accountId,
    status: expenseStatusSchema.parse(record.status),
    category: expenseCategorySchema.parse(record.category),
    amountMinorUnits: record.amountMinorUnits.toString(),
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    description: record.description,
    payee: record.payee,
    occurredAt: record.occurredAt.toISOString(),
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    voidedAt: record.voidedAt?.toISOString() ?? null,
    voidReason: record.voidReason,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toCashTransfer(
  record: CashTransferRecord,
  outMovementId: string,
  inMovementId: string,
): CashTransfer {
  return {
    id: record.id,
    fromAccountId: record.fromAccountId,
    toAccountId: record.toAccountId,
    amountMinorUnits: record.amountMinorUnits.toString(),
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    occurredAt: record.occurredAt.toISOString(),
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    note: record.note,
    outMovementId,
    inMovementId,
    createdAt: record.createdAt.toISOString(),
  };
}
