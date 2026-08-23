import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.ts";
import { businessSettings } from "./business.ts";

export const sale = pgTable(
  "sale",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    status: text("status").default("posted").notNull(),
    entryMode: text("entry_mode").default("total_only").notNull(),
    grossMinorUnits: bigint("gross_minor_units", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    currencyMinorUnitDigits: smallint("currency_minor_unit_digits").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    occurredLocalDate: text("occurred_local_date").notNull(),
    occurredLocalTime: text("occurred_local_time").notNull(),
    timeZone: text("time_zone").notNull(),
    description: text("description"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("sale_status_check", sql`${table.status} in ('posted', 'voided')`),
    check("sale_entry_mode_check", sql`${table.entryMode} = 'total_only'`),
    check("sale_gross_minor_units_positive_check", sql`${table.grossMinorUnits} > 0`),
    check("sale_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("sale_currency_digits_check", sql`${table.currencyMinorUnitDigits} between 0 and 4`),
    check("sale_local_date_check", sql`${table.occurredLocalDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`),
    check("sale_local_time_check", sql`${table.occurredLocalTime} ~ '^\\d{2}:\\d{2}$'`),
    check("sale_time_zone_length_check", sql`char_length(${table.timeZone}) between 1 and 64`),
    check(
      "sale_description_length_check",
      sql`${table.description} is null or char_length(${table.description}) between 1 and 240`,
    ),
    uniqueIndex("sale_business_id_id_unique").on(table.businessId, table.id),
    foreignKey({
      columns: [table.businessId, table.currency, table.currencyMinorUnitDigits],
      foreignColumns: [
        businessSettings.businessId,
        businessSettings.currency,
        businessSettings.currencyMinorUnitDigits,
      ],
      name: "sale_business_currency_digits_fk",
    }).onDelete("restrict"),
    index("sale_business_status_occurred_at_idx").on(
      table.businessId,
      table.status,
      table.occurredAt,
    ),
    index("sale_business_created_at_idx").on(table.businessId, table.createdAt, table.id),
    index("sale_business_status_created_at_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
      table.id,
    ),
  ],
);

export const saleOperation = pgTable(
  "sale_operation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessSettings.businessId, { onDelete: "restrict" }),
    saleId: uuid("sale_id").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    commandFingerprint: text("command_fingerprint").notNull(),
    action: text("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId, table.saleId],
      foreignColumns: [sale.businessId, sale.id],
      name: "sale_operation_business_sale_fk",
    }).onDelete("restrict"),
    check("sale_operation_action_check", sql`${table.action} = 'sale.posted'`),
    check("sale_operation_fingerprint_check", sql`${table.commandFingerprint} ~ '^[a-f0-9]{64}$'`),
    uniqueIndex("sale_operation_actor_key_unique").on(
      table.businessId,
      table.actorUserId,
      table.idempotencyKey,
    ),
    index("sale_operation_sale_id_idx").on(table.saleId),
  ],
);

export const saleCorrection = pgTable(
  "sale_correction",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessSettings.businessId, { onDelete: "restrict" }),
    originalSaleId: uuid("original_sale_id").notNull(),
    replacementSaleId: uuid("replacement_sale_id"),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    commandFingerprint: text("command_fingerprint").notNull(),
    kind: text("kind").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("sale_correction_kind_check", sql`${table.kind} in ('void', 'replacement')`),
    check(
      "sale_correction_replacement_check",
      sql`(${table.kind} = 'void' and ${table.replacementSaleId} is null)
        or (${table.kind} = 'replacement' and ${table.replacementSaleId} is not null)`,
    ),
    check(
      "sale_correction_distinct_sales_check",
      sql`${table.replacementSaleId} is null or ${table.replacementSaleId} <> ${table.originalSaleId}`,
    ),
    check(
      "sale_correction_reason_length_check",
      sql`char_length(${table.reason}) between 2 and 240`,
    ),
    check("sale_correction_fingerprint_check", sql`${table.commandFingerprint} ~ '^[a-f0-9]{64}$'`),
    foreignKey({
      columns: [table.businessId, table.originalSaleId],
      foreignColumns: [sale.businessId, sale.id],
      name: "sale_correction_business_original_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.replacementSaleId],
      foreignColumns: [sale.businessId, sale.id],
      name: "sale_correction_business_replacement_fk",
    }).onDelete("restrict"),
    uniqueIndex("sale_correction_business_original_unique").on(
      table.businessId,
      table.originalSaleId,
    ),
    uniqueIndex("sale_correction_business_replacement_unique").on(
      table.businessId,
      table.replacementSaleId,
    ),
    uniqueIndex("sale_correction_actor_key_unique").on(
      table.businessId,
      table.actorUserId,
      table.idempotencyKey,
    ),
    index("sale_correction_business_created_at_idx").on(table.businessId, table.createdAt),
  ],
);
