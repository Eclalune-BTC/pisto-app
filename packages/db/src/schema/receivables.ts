import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.ts";
import { businessSettings } from "./business.ts";
import { cashAccount } from "./cash-account.ts";

export const customer = pgTable(
  "customer",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessSettings.businessId, { onDelete: "restrict" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("customer_name_length_check", sql`char_length(${table.name}) between 1 and 120`),
    check(
      "customer_phone_length_check",
      sql`${table.phone} is null or char_length(${table.phone}) between 1 and 40`,
    ),
    check(
      "customer_email_length_check",
      sql`${table.email} is null or char_length(${table.email}) between 3 and 254`,
    ),
    check(
      "customer_notes_length_check",
      sql`${table.notes} is null or char_length(${table.notes}) between 1 and 1000`,
    ),
    check("customer_status_check", sql`${table.status} in ('active', 'archived')`),
    unique("customer_business_id_id_unique").on(table.businessId, table.id),
    index("customer_business_status_created_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index("customer_business_name_idx").on(table.businessId, table.name),
  ],
);

export const receivable = pgTable(
  "receivable",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    status: text("status").default("posted").notNull(),
    originalMinorUnits: bigint("original_minor_units", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    currencyMinorUnitDigits: smallint("currency_minor_unit_digits").notNull(),
    description: text("description").notNull(),
    postedDate: text("posted_date").notNull(),
    dueDate: text("due_date"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    voidedByUserId: text("voided_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    voidedAt: timestamp("voided_at", { withTimezone: true, mode: "date" }),
    voidReason: text("void_reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("receivable_status_check", sql`${table.status} in ('posted', 'voided')`),
    check("receivable_original_minor_units_positive_check", sql`${table.originalMinorUnits} > 0`),
    check("receivable_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "receivable_currency_digits_check",
      sql`${table.currencyMinorUnitDigits} between 0 and 4`,
    ),
    check(
      "receivable_description_length_check",
      sql`char_length(${table.description}) between 1 and 240`,
    ),
    check("receivable_posted_date_check", sql`${table.postedDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`),
    check(
      "receivable_due_date_check",
      sql`${table.dueDate} is null or (${table.dueDate} ~ '^\\d{4}-\\d{2}-\\d{2}$' and ${table.dueDate} >= ${table.postedDate})`,
    ),
    check(
      "receivable_void_state_check",
      sql`(
        ${table.status} = 'posted'
        and ${table.voidedByUserId} is null
        and ${table.voidedAt} is null
        and ${table.voidReason} is null
      ) or (
        ${table.status} = 'voided'
        and ${table.voidedByUserId} is not null
        and ${table.voidedAt} is not null
        and char_length(${table.voidReason}) between 1 and 240
      )`,
    ),
    unique("receivable_business_id_id_unique").on(table.businessId, table.id),
    unique("receivable_business_customer_id_id_unique").on(
      table.businessId,
      table.customerId,
      table.id,
    ),
    foreignKey({
      columns: [table.businessId, table.customerId],
      foreignColumns: [customer.businessId, customer.id],
      name: "receivable_business_customer_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.currency, table.currencyMinorUnitDigits],
      foreignColumns: [
        businessSettings.businessId,
        businessSettings.currency,
        businessSettings.currencyMinorUnitDigits,
      ],
      name: "receivable_business_currency_digits_fk",
    }).onDelete("restrict"),
    index("receivable_business_status_due_idx").on(
      table.businessId,
      table.status,
      table.dueDate,
      table.createdAt,
      table.id,
    ),
    index("receivable_business_customer_created_idx").on(
      table.businessId,
      table.customerId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const receivablePayment = pgTable(
  "receivable_payment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    receivableId: uuid("receivable_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    kind: text("kind").notNull(),
    amountMinorUnits: bigint("amount_minor_units", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    currencyMinorUnitDigits: smallint("currency_minor_unit_digits").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    occurredLocalDate: text("occurred_local_date").notNull(),
    occurredLocalTime: text("occurred_local_time").notNull(),
    timeZone: text("time_zone").notNull(),
    cashAccountId: uuid("cash_account_id").notNull(),
    reference: text("reference"),
    reversesPaymentId: uuid("reverses_payment_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("receivable_payment_kind_check", sql`${table.kind} in ('payment', 'reversal')`),
    check("receivable_payment_amount_positive_check", sql`${table.amountMinorUnits} > 0`),
    check("receivable_payment_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "receivable_payment_currency_digits_check",
      sql`${table.currencyMinorUnitDigits} between 0 and 4`,
    ),
    check(
      "receivable_payment_local_date_check",
      sql`${table.occurredLocalDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`,
    ),
    check(
      "receivable_payment_local_time_check",
      sql`${table.occurredLocalTime} ~ '^\\d{2}:\\d{2}$'`,
    ),
    check(
      "receivable_payment_time_zone_length_check",
      sql`char_length(${table.timeZone}) between 1 and 64`,
    ),
    check(
      "receivable_payment_reference_length_check",
      sql`${table.reference} is null or char_length(${table.reference}) between 1 and 120`,
    ),
    check(
      "receivable_payment_reversal_shape_check",
      sql`(${table.kind} = 'payment' and ${table.reversesPaymentId} is null)
          or (${table.kind} = 'reversal' and ${table.reversesPaymentId} is not null)`,
    ),
    unique("receivable_payment_business_id_id_unique").on(table.businessId, table.id),
    unique("receivable_payment_business_receivable_customer_id_unique").on(
      table.businessId,
      table.receivableId,
      table.customerId,
      table.id,
    ),
    uniqueIndex("receivable_payment_reversal_once_unique")
      .on(table.reversesPaymentId)
      .where(sql`${table.reversesPaymentId} is not null`),
    foreignKey({
      columns: [table.businessId, table.receivableId, table.customerId],
      foreignColumns: [receivable.businessId, receivable.id, receivable.customerId],
      name: "receivable_payment_business_receivable_customer_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.receivableId, table.customerId, table.reversesPaymentId],
      foreignColumns: [table.businessId, table.receivableId, table.customerId, table.id],
      name: "receivable_payment_reversal_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.currency, table.currencyMinorUnitDigits],
      foreignColumns: [
        businessSettings.businessId,
        businessSettings.currency,
        businessSettings.currencyMinorUnitDigits,
      ],
      name: "receivable_payment_business_currency_digits_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.cashAccountId],
      foreignColumns: [cashAccount.businessId, cashAccount.id],
      name: "receivable_payment_business_cash_account_fk",
    }).onDelete("restrict"),
    index("receivable_payment_business_receivable_created_idx").on(
      table.businessId,
      table.receivableId,
      table.createdAt,
      table.id,
    ),
    index("receivable_payment_cash_account_idx").on(table.businessId, table.cashAccountId),
  ],
);

export const receivableOperation = pgTable(
  "receivable_operation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    commandFingerprint: text("command_fingerprint").notNull(),
    action: text("action").notNull(),
    customerId: uuid("customer_id").notNull(),
    receivableId: uuid("receivable_id"),
    paymentId: uuid("payment_id"),
    resultSnapshot: jsonb("result_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "receivable_operation_action_check",
      sql`${table.action} in (
        'customer.created',
        'customer.updated',
        'customer.archived',
        'receivable.posted',
        'receivable.voided',
        'receivable.payment_applied',
        'receivable.payment_reversed'
      )`,
    ),
    check(
      "receivable_operation_target_shape_check",
      sql`(
        ${table.action} like 'customer.%'
        and ${table.receivableId} is null
        and ${table.paymentId} is null
      ) or (
        ${table.action} in ('receivable.posted', 'receivable.voided')
        and ${table.receivableId} is not null
        and ${table.paymentId} is null
      ) or (
        ${table.action} in ('receivable.payment_applied', 'receivable.payment_reversed')
        and ${table.receivableId} is not null
        and ${table.paymentId} is not null
      )`,
    ),
    check(
      "receivable_operation_fingerprint_check",
      sql`${table.commandFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    uniqueIndex("receivable_operation_actor_key_unique").on(
      table.businessId,
      table.actorUserId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businessSettings.businessId],
      name: "receivable_operation_business_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.customerId],
      foreignColumns: [customer.businessId, customer.id],
      name: "receivable_operation_business_customer_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.receivableId, table.customerId],
      foreignColumns: [receivable.businessId, receivable.id, receivable.customerId],
      name: "receivable_operation_business_receivable_customer_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.receivableId, table.customerId, table.paymentId],
      foreignColumns: [
        receivablePayment.businessId,
        receivablePayment.receivableId,
        receivablePayment.customerId,
        receivablePayment.id,
      ],
      name: "receivable_operation_business_payment_fk",
    }).onDelete("restrict"),
    index("receivable_operation_customer_idx").on(table.businessId, table.customerId),
    index("receivable_operation_receivable_idx").on(table.businessId, table.receivableId),
  ],
);
