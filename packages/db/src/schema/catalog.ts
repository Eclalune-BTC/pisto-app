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

export const catalogCategory = pgTable(
  "catalog_category",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessSettings.businessId, { onDelete: "restrict" }),
    name: text("name").notNull(),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "catalog_category_name_check",
      sql`char_length(${table.name}) between 1 and 80 and btrim(${table.name}) = ${table.name}`,
    ),
    check("catalog_category_status_check", sql`${table.status} in ('active', 'archived')`),
    uniqueIndex("catalog_category_business_id_id_unique").on(table.businessId, table.id),
    uniqueIndex("catalog_category_business_name_ci_unique").on(
      table.businessId,
      sql`lower(${table.name})`,
    ),
    index("catalog_category_business_status_created_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
      table.id,
    ),
  ],
);

export const catalogProduct = pgTable(
  "catalog_product",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessSettings.businessId, { onDelete: "restrict" }),
    categoryId: uuid("category_id"),
    name: text("name").notNull(),
    sku: text("sku"),
    sellingPriceMinorUnits: bigint("selling_price_minor_units", { mode: "bigint" }),
    sellingPriceCurrency: text("selling_price_currency"),
    sellingPriceCurrencyMinorUnitDigits: smallint("selling_price_currency_minor_unit_digits"),
    unitKind: text("unit_kind").notNull(),
    quantityPrecision: smallint("quantity_precision").notNull(),
    tracked: boolean("tracked").default(true).notNull(),
    lowStockThresholdMinorUnits: bigint("low_stock_threshold_minor_units", { mode: "bigint" }),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "catalog_product_name_check",
      sql`char_length(${table.name}) between 1 and 120 and btrim(${table.name}) = ${table.name}`,
    ),
    check(
      "catalog_product_sku_check",
      sql`${table.sku} is null or (char_length(${table.sku}) between 1 and 64 and btrim(${table.sku}) = ${table.sku})`,
    ),
    check(
      "catalog_product_price_snapshot_check",
      sql`(
        ${table.sellingPriceMinorUnits} is null
        and ${table.sellingPriceCurrency} is null
        and ${table.sellingPriceCurrencyMinorUnitDigits} is null
      ) or (
        ${table.sellingPriceMinorUnits} >= 0
        and ${table.sellingPriceCurrency} ~ '^[A-Z]{3}$'
        and ${table.sellingPriceCurrencyMinorUnitDigits} between 0 and 4
      )`,
    ),
    check(
      "catalog_product_unit_kind_check",
      sql`${table.unitKind} in ('unit', 'kilogram', 'gram', 'liter', 'milliliter', 'meter')`,
    ),
    check(
      "catalog_product_quantity_precision_check",
      sql`${table.quantityPrecision} between 0 and 3`,
    ),
    check(
      "catalog_product_low_stock_check",
      sql`${table.lowStockThresholdMinorUnits} is null or (${table.tracked} and ${table.lowStockThresholdMinorUnits} >= 0)`,
    ),
    check("catalog_product_status_check", sql`${table.status} in ('active', 'archived')`),
    foreignKey({
      columns: [table.businessId, table.categoryId],
      foreignColumns: [catalogCategory.businessId, catalogCategory.id],
      name: "catalog_product_business_category_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [
        table.businessId,
        table.sellingPriceCurrency,
        table.sellingPriceCurrencyMinorUnitDigits,
      ],
      foreignColumns: [
        businessSettings.businessId,
        businessSettings.currency,
        businessSettings.currencyMinorUnitDigits,
      ],
      name: "catalog_product_business_price_currency_fk",
    }).onDelete("restrict"),
    uniqueIndex("catalog_product_business_id_id_unique").on(table.businessId, table.id),
    uniqueIndex("catalog_product_business_sku_ci_unique")
      .on(table.businessId, sql`lower(${table.sku})`)
      .where(sql`${table.sku} is not null`),
    index("catalog_product_business_status_created_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index("catalog_product_business_category_idx").on(table.businessId, table.categoryId),
  ],
);

export const inventoryMovement = pgTable(
  "inventory_movement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    productId: uuid("product_id").notNull(),
    action: text("action").notNull(),
    quantityMinorUnits: bigint("quantity_minor_units", { mode: "bigint" }).notNull(),
    deltaMinorUnits: bigint("delta_minor_units", { mode: "bigint" }).notNull(),
    quantityPrecision: smallint("quantity_precision").notNull(),
    reason: text("reason").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    occurredLocalDate: text("occurred_local_date").notNull(),
    occurredLocalTime: text("occurred_local_time").notNull(),
    timeZone: text("time_zone").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reversesMovementId: uuid("reverses_movement_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "inventory_movement_action_check",
      sql`${table.action} in ('receive', 'adjust_in', 'adjust_out', 'reverse')`,
    ),
    check("inventory_movement_quantity_positive_check", sql`${table.quantityMinorUnits} > 0`),
    check(
      "inventory_movement_delta_check",
      sql`(
        ${table.action} in ('receive', 'adjust_in') and ${table.deltaMinorUnits} > 0
      ) or (
        ${table.action} = 'adjust_out' and ${table.deltaMinorUnits} < 0
      ) or (
        ${table.action} = 'reverse' and ${table.deltaMinorUnits} <> 0
      )`,
    ),
    check("inventory_movement_precision_check", sql`${table.quantityPrecision} between 0 and 3`),
    check(
      "inventory_movement_reason_check",
      sql`char_length(${table.reason}) between 1 and 240 and btrim(${table.reason}) = ${table.reason}`,
    ),
    check(
      "inventory_movement_reversal_link_check",
      sql`(${table.action} = 'reverse') = (${table.reversesMovementId} is not null)`,
    ),
    check(
      "inventory_movement_local_date_check",
      sql`${table.occurredLocalDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`,
    ),
    check(
      "inventory_movement_local_time_check",
      sql`${table.occurredLocalTime} ~ '^\\d{2}:\\d{2}$'`,
    ),
    check(
      "inventory_movement_time_zone_check",
      sql`char_length(${table.timeZone}) between 1 and 64`,
    ),
    foreignKey({
      columns: [table.businessId, table.productId],
      foreignColumns: [catalogProduct.businessId, catalogProduct.id],
      name: "inventory_movement_business_product_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.productId, table.reversesMovementId],
      foreignColumns: [table.businessId, table.productId, table.id],
      name: "inventory_movement_reversal_fk",
    }).onDelete("restrict"),
    uniqueIndex("inventory_movement_business_product_id_unique").on(
      table.businessId,
      table.productId,
      table.id,
    ),
    uniqueIndex("inventory_movement_reverses_once_unique")
      .on(table.reversesMovementId)
      .where(sql`${table.reversesMovementId} is not null`),
    index("inventory_movement_business_product_created_idx").on(
      table.businessId,
      table.productId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const catalogOperation = pgTable(
  "catalog_operation",
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
    categoryId: uuid("category_id"),
    productId: uuid("product_id"),
    movementId: uuid("movement_id"),
    resultSnapshot: jsonb("result_snapshot").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "catalog_operation_action_check",
      sql`${table.action} in (
        'category.created', 'category.updated', 'category.archived',
        'product.created', 'product.updated', 'product.archived',
        'inventory.receive', 'inventory.adjust_in', 'inventory.adjust_out', 'inventory.reverse'
      )`,
    ),
    check(
      "catalog_operation_target_check",
      sql`(
        ${table.action} like 'category.%'
        and ${table.categoryId} is not null
        and ${table.productId} is null
        and ${table.movementId} is null
      ) or (
        ${table.action} like 'product.%'
        and ${table.categoryId} is null
        and ${table.productId} is not null
        and ${table.movementId} is null
      ) or (
        ${table.action} like 'inventory.%'
        and ${table.categoryId} is null
        and ${table.productId} is not null
        and ${table.movementId} is not null
      )`,
    ),
    check(
      "catalog_operation_fingerprint_check",
      sql`${table.commandFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    foreignKey({
      columns: [table.businessId, table.categoryId],
      foreignColumns: [catalogCategory.businessId, catalogCategory.id],
      name: "catalog_operation_business_category_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.productId],
      foreignColumns: [catalogProduct.businessId, catalogProduct.id],
      name: "catalog_operation_business_product_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.productId, table.movementId],
      foreignColumns: [
        inventoryMovement.businessId,
        inventoryMovement.productId,
        inventoryMovement.id,
      ],
      name: "catalog_operation_business_movement_fk",
    }).onDelete("restrict"),
    uniqueIndex("catalog_operation_actor_key_unique").on(
      table.businessId,
      table.actorUserId,
      table.idempotencyKey,
    ),
    index("catalog_operation_category_idx").on(table.categoryId),
    index("catalog_operation_product_idx").on(table.productId),
    index("catalog_operation_movement_idx").on(table.movementId),
  ],
);
