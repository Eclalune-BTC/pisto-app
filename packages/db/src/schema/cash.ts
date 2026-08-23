import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.ts";
import { businessSettings } from "./business.ts";

export const cashAccount = pgTable(
  "cash_account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    status: text("status").default("active").notNull(),
    allowNegativeBalance: boolean("allow_negative_balance").default(false).notNull(),
    currency: text("currency").notNull(),
    currencyMinorUnitDigits: smallint("currency_minor_unit_digits").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("cash_account_name_length_check", sql`char_length(${table.name}) between 1 and 80`),
    check(
      "cash_account_kind_check",
      sql`${table.kind} in ('cash', 'bank', 'mobile_money', 'other')`,
    ),
    check("cash_account_status_check", sql`${table.status} in ('active', 'archived')`),
    check("cash_account_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "cash_account_currency_digits_check",
      sql`${table.currencyMinorUnitDigits} between 0 and 4`,
    ),
    uniqueIndex("cash_account_business_id_id_unique").on(table.businessId, table.id),
    uniqueIndex("cash_account_business_name_unique").on(
      table.businessId,
      sql`lower(${table.name})`,
    ),
    foreignKey({
      columns: [table.businessId, table.currency, table.currencyMinorUnitDigits],
      foreignColumns: [
        businessSettings.businessId,
        businessSettings.currency,
        businessSettings.currencyMinorUnitDigits,
      ],
      name: "cash_account_business_currency_digits_fk",
    }).onDelete("restrict"),
    index("cash_account_business_status_created_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
      table.id,
    ),
  ],
);

export const expense = pgTable(
  "expense",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    accountId: uuid("account_id").notNull(),
    status: text("status").default("posted").notNull(),
    category: text("category").notNull(),
    amountMinorUnits: bigint("amount_minor_units", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    currencyMinorUnitDigits: smallint("currency_minor_unit_digits").notNull(),
    description: text("description").notNull(),
    payee: text("payee"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    occurredLocalDate: text("occurred_local_date").notNull(),
    occurredLocalTime: text("occurred_local_time").notNull(),
    timeZone: text("time_zone").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    voidedAt: timestamp("voided_at", { withTimezone: true, mode: "date" }),
    voidedByUserId: text("voided_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    voidReason: text("void_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("expense_status_check", sql`${table.status} in ('posted', 'voided')`),
    check(
      "expense_category_check",
      sql`${table.category} in ('inventory', 'rent', 'utilities', 'payroll', 'transport', 'marketing', 'tax', 'other')`,
    ),
    check("expense_amount_positive_check", sql`${table.amountMinorUnits} > 0`),
    check("expense_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("expense_currency_digits_check", sql`${table.currencyMinorUnitDigits} between 0 and 4`),
    check(
      "expense_description_length_check",
      sql`char_length(${table.description}) between 1 and 240`,
    ),
    check(
      "expense_payee_length_check",
      sql`${table.payee} is null or char_length(${table.payee}) between 1 and 120`,
    ),
    check("expense_local_date_check", sql`${table.occurredLocalDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`),
    check("expense_local_time_check", sql`${table.occurredLocalTime} ~ '^\\d{2}:\\d{2}$'`),
    check("expense_time_zone_length_check", sql`char_length(${table.timeZone}) between 1 and 64`),
    check(
      "expense_void_shape_check",
      sql`(
        ${table.status} = 'posted'
        and ${table.voidedAt} is null
        and ${table.voidedByUserId} is null
        and ${table.voidReason} is null
      ) or (
        ${table.status} = 'voided'
        and ${table.voidedAt} is not null
        and ${table.voidedByUserId} is not null
        and char_length(${table.voidReason}) between 1 and 240
      )`,
    ),
    uniqueIndex("expense_business_id_id_unique").on(table.businessId, table.id),
    foreignKey({
      columns: [table.businessId, table.accountId],
      foreignColumns: [cashAccount.businessId, cashAccount.id],
      name: "expense_business_account_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.currency, table.currencyMinorUnitDigits],
      foreignColumns: [
        businessSettings.businessId,
        businessSettings.currency,
        businessSettings.currencyMinorUnitDigits,
      ],
      name: "expense_business_currency_digits_fk",
    }).onDelete("restrict"),
    index("expense_business_status_occurred_idx").on(
      table.businessId,
      table.status,
      table.occurredAt,
      table.id,
    ),
    index("expense_business_category_occurred_idx").on(
      table.businessId,
      table.category,
      table.occurredAt,
    ),
    index("expense_business_account_created_idx").on(
      table.businessId,
      table.accountId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const cashTransfer = pgTable(
  "cash_transfer",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    fromAccountId: uuid("from_account_id").notNull(),
    toAccountId: uuid("to_account_id").notNull(),
    amountMinorUnits: bigint("amount_minor_units", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    currencyMinorUnitDigits: smallint("currency_minor_unit_digits").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    occurredLocalDate: text("occurred_local_date").notNull(),
    occurredLocalTime: text("occurred_local_time").notNull(),
    timeZone: text("time_zone").notNull(),
    note: text("note"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "cash_transfer_accounts_different_check",
      sql`${table.fromAccountId} <> ${table.toAccountId}`,
    ),
    check("cash_transfer_amount_positive_check", sql`${table.amountMinorUnits} > 0`),
    check("cash_transfer_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "cash_transfer_currency_digits_check",
      sql`${table.currencyMinorUnitDigits} between 0 and 4`,
    ),
    check(
      "cash_transfer_local_date_check",
      sql`${table.occurredLocalDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`,
    ),
    check("cash_transfer_local_time_check", sql`${table.occurredLocalTime} ~ '^\\d{2}:\\d{2}$'`),
    check(
      "cash_transfer_time_zone_length_check",
      sql`char_length(${table.timeZone}) between 1 and 64`,
    ),
    check(
      "cash_transfer_note_length_check",
      sql`${table.note} is null or char_length(${table.note}) between 1 and 240`,
    ),
    uniqueIndex("cash_transfer_business_id_id_unique").on(table.businessId, table.id),
    foreignKey({
      columns: [table.businessId, table.fromAccountId],
      foreignColumns: [cashAccount.businessId, cashAccount.id],
      name: "cash_transfer_business_from_account_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.toAccountId],
      foreignColumns: [cashAccount.businessId, cashAccount.id],
      name: "cash_transfer_business_to_account_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.currency, table.currencyMinorUnitDigits],
      foreignColumns: [
        businessSettings.businessId,
        businessSettings.currency,
        businessSettings.currencyMinorUnitDigits,
      ],
      name: "cash_transfer_business_currency_digits_fk",
    }).onDelete("restrict"),
    index("cash_transfer_business_occurred_idx").on(table.businessId, table.occurredAt, table.id),
  ],
);

export const cashMovement = pgTable(
  "cash_movement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    accountId: uuid("account_id").notNull(),
    direction: text("direction").notNull(),
    action: text("action").notNull(),
    amountMinorUnits: bigint("amount_minor_units", { mode: "bigint" }).notNull(),
    deltaMinorUnits: bigint("delta_minor_units", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    currencyMinorUnitDigits: smallint("currency_minor_unit_digits").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    occurredLocalDate: text("occurred_local_date").notNull(),
    occurredLocalTime: text("occurred_local_time").notNull(),
    timeZone: text("time_zone").notNull(),
    reason: text("reason").notNull(),
    expenseId: uuid("expense_id"),
    transferId: uuid("transfer_id"),
    receivablePaymentId: uuid("receivable_payment_id"),
    reversalOfMovementId: uuid("reversal_of_movement_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("cash_movement_direction_check", sql`${table.direction} in ('in', 'out')`),
    check(
      "cash_movement_action_check",
      sql`${table.action} in ('opening', 'expense', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out', 'receivable_payment', 'reverse')`,
    ),
    check("cash_movement_amount_positive_check", sql`${table.amountMinorUnits} > 0`),
    check(
      "cash_movement_delta_direction_check",
      sql`(
        ${table.direction} = 'in' and ${table.deltaMinorUnits} = ${table.amountMinorUnits}
      ) or (
        ${table.direction} = 'out' and ${table.deltaMinorUnits} = -${table.amountMinorUnits}
      )`,
    ),
    check("cash_movement_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "cash_movement_currency_digits_check",
      sql`${table.currencyMinorUnitDigits} between 0 and 4`,
    ),
    check(
      "cash_movement_local_date_check",
      sql`${table.occurredLocalDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`,
    ),
    check("cash_movement_local_time_check", sql`${table.occurredLocalTime} ~ '^\\d{2}:\\d{2}$'`),
    check(
      "cash_movement_time_zone_length_check",
      sql`char_length(${table.timeZone}) between 1 and 64`,
    ),
    check("cash_movement_reason_length_check", sql`char_length(${table.reason}) between 1 and 240`),
    check(
      "cash_movement_action_direction_check",
      sql`(
        ${table.action} in ('expense', 'adjustment_out', 'transfer_out') and ${table.direction} = 'out'
      ) or (
        ${table.action} in ('adjustment_in', 'transfer_in', 'receivable_payment') and ${table.direction} = 'in'
      ) or ${table.action} in ('opening', 'reverse')`,
    ),
    check(
      "cash_movement_source_shape_check",
      sql`(
        ${table.action} = 'expense'
        and ${table.expenseId} is not null
        and ${table.transferId} is null
        and ${table.receivablePaymentId} is null
        and ${table.reversalOfMovementId} is null
      ) or (
        ${table.action} in ('transfer_in', 'transfer_out')
        and ${table.expenseId} is null
        and ${table.transferId} is not null
        and ${table.receivablePaymentId} is null
        and ${table.reversalOfMovementId} is null
      ) or (
        ${table.action} = 'receivable_payment'
        and ${table.expenseId} is null
        and ${table.transferId} is null
        and ${table.receivablePaymentId} is not null
        and ${table.reversalOfMovementId} is null
      ) or (
        ${table.action} = 'reverse'
        and ${table.expenseId} is null
        and ${table.transferId} is null
        and ${table.receivablePaymentId} is null
        and ${table.reversalOfMovementId} is not null
      ) or (
        ${table.action} in ('opening', 'adjustment_in', 'adjustment_out')
        and ${table.expenseId} is null
        and ${table.transferId} is null
        and ${table.receivablePaymentId} is null
        and ${table.reversalOfMovementId} is null
      )`,
    ),
    uniqueIndex("cash_movement_business_id_id_unique").on(table.businessId, table.id),
    uniqueIndex("cash_movement_expense_unique").on(table.businessId, table.expenseId),
    uniqueIndex("cash_movement_transfer_action_unique").on(
      table.businessId,
      table.transferId,
      table.action,
    ),
    uniqueIndex("cash_movement_reversal_unique").on(table.businessId, table.reversalOfMovementId),
    foreignKey({
      columns: [table.businessId, table.accountId],
      foreignColumns: [cashAccount.businessId, cashAccount.id],
      name: "cash_movement_business_account_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.expenseId],
      foreignColumns: [expense.businessId, expense.id],
      name: "cash_movement_business_expense_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.transferId],
      foreignColumns: [cashTransfer.businessId, cashTransfer.id],
      name: "cash_movement_business_transfer_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.reversalOfMovementId],
      foreignColumns: [table.businessId, table.id],
      name: "cash_movement_business_reversal_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.currency, table.currencyMinorUnitDigits],
      foreignColumns: [
        businessSettings.businessId,
        businessSettings.currency,
        businessSettings.currencyMinorUnitDigits,
      ],
      name: "cash_movement_business_currency_digits_fk",
    }).onDelete("restrict"),
    index("cash_movement_business_account_created_idx").on(
      table.businessId,
      table.accountId,
      table.createdAt,
      table.id,
    ),
    index("cash_movement_business_occurred_idx").on(table.businessId, table.occurredAt, table.id),
  ],
);

export const cashOperationReceipt = pgTable(
  "cash_operation_receipt",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessSettings.businessId, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    commandFingerprint: text("command_fingerprint").notNull(),
    action: text("action").notNull(),
    resourceId: uuid("resource_id").notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "cash_operation_receipt_action_check",
      sql`${table.action} in ('cash_account.create', 'cash_account.update', 'cash_account.archive', 'expense.post', 'expense.void', 'cash.adjust', 'cash.reverse', 'cash.transfer')`,
    ),
    check(
      "cash_operation_receipt_fingerprint_check",
      sql`${table.commandFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    uniqueIndex("cash_operation_receipt_actor_key_unique").on(
      table.businessId,
      table.actorUserId,
      table.idempotencyKey,
    ),
    index("cash_operation_receipt_resource_idx").on(
      table.businessId,
      table.action,
      table.resourceId,
    ),
  ],
);
