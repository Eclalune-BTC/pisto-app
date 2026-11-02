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
import { catalogProduct, inventoryMovement } from "./catalog.ts";

export const supplier = pgTable(
  "supplier",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businessSettings.businessId, { onDelete: "restrict" }),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    taxId: text("tax_id"),
    creditDays: smallint("credit_days"),
    notes: text("notes"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => sql`transaction_timestamp()`)
      .notNull(),
  },
  (table) => [
    check("supplier_name_length_check", sql`char_length(${table.name}) between 1 and 120`),
    check(
      "supplier_contact_name_length_check",
      sql`${table.contactName} is null or char_length(${table.contactName}) between 1 and 120`,
    ),
    check(
      "supplier_phone_length_check",
      sql`${table.phone} is null or char_length(${table.phone}) between 1 and 40`,
    ),
    check(
      "supplier_email_length_check",
      sql`${table.email} is null or char_length(${table.email}) between 3 and 254`,
    ),
    check(
      "supplier_tax_id_length_check",
      sql`${table.taxId} is null or char_length(${table.taxId}) between 1 and 40`,
    ),
    check(
      "supplier_credit_days_check",
      sql`${table.creditDays} is null or ${table.creditDays} between 0 and 365`,
    ),
    check(
      "supplier_notes_length_check",
      sql`${table.notes} is null or char_length(${table.notes}) between 1 and 1000`,
    ),
    check("supplier_status_check", sql`${table.status} in ('active', 'archived')`),
    unique("supplier_business_id_id_unique").on(table.businessId, table.id),
    index("supplier_business_status_created_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index("supplier_business_name_idx").on(table.businessId, table.name),
  ],
);

export const purchase = pgTable(
  "purchase",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    supplierId: uuid("supplier_id").notNull(),
    status: text("status").default("posted").notNull(),
    invoiceNumber: text("invoice_number"),
    entrySource: text("entry_source").notNull(),
    paymentTerms: text("payment_terms").notNull(),
    /** The account a cash purchase was paid from; credit purchases are paid through payments. */
    cashAccountId: uuid("cash_account_id"),
    totalMinorUnits: bigint("total_minor_units", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    currencyMinorUnitDigits: smallint("currency_minor_unit_digits").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    occurredLocalDate: text("occurred_local_date").notNull(),
    occurredLocalTime: text("occurred_local_time").notNull(),
    timeZone: text("time_zone").notNull(),
    dueDate: text("due_date"),
    note: text("note"),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }),
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
      .$onUpdate(() => sql`transaction_timestamp()`)
      .notNull(),
  },
  (table) => [
    check("purchase_status_check", sql`${table.status} in ('posted', 'voided')`),
    check(
      "purchase_invoice_number_length_check",
      sql`${table.invoiceNumber} is null or char_length(${table.invoiceNumber}) between 1 and 40`,
    ),
    check("purchase_entry_source_check", sql`${table.entrySource} in ('manual', 'voice', 'text')`),
    check(
      "purchase_terms_check",
      sql`(
        ${table.paymentTerms} = 'cash'
        and ${table.cashAccountId} is not null
        and ${table.dueDate} is null
      ) or (
        ${table.paymentTerms} = 'credit'
        and ${table.cashAccountId} is null
        and ${table.dueDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'
        and ${table.dueDate} >= ${table.occurredLocalDate}
      )`,
    ),
    check("purchase_total_positive_check", sql`${table.totalMinorUnits} > 0`),
    check("purchase_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("purchase_currency_digits_check", sql`${table.currencyMinorUnitDigits} between 0 and 4`),
    check("purchase_local_date_check", sql`${table.occurredLocalDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`),
    check("purchase_local_time_check", sql`${table.occurredLocalTime} ~ '^\\d{2}:\\d{2}$'`),
    check("purchase_time_zone_length_check", sql`char_length(${table.timeZone}) between 1 and 64`),
    check(
      "purchase_note_length_check",
      sql`${table.note} is null or char_length(${table.note}) between 1 and 240`,
    ),
    check(
      "purchase_void_shape_check",
      sql`(
        ${table.status} = 'posted'
        and ${table.voidedAt} is null
        and ${table.voidedByUserId} is null
        and ${table.voidReason} is null
      ) or (
        ${table.status} = 'voided'
        and ${table.voidedAt} is not null
        and ${table.voidedByUserId} is not null
        and ${table.voidReason} is not null
        and char_length(${table.voidReason}) between 1 and 240
      )`,
    ),
    unique("purchase_business_id_id_unique").on(table.businessId, table.id),
    unique("purchase_business_supplier_id_unique").on(table.businessId, table.supplierId, table.id),
    foreignKey({
      columns: [table.businessId, table.supplierId],
      foreignColumns: [supplier.businessId, supplier.id],
      name: "purchase_business_supplier_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.cashAccountId],
      foreignColumns: [cashAccount.businessId, cashAccount.id],
      name: "purchase_business_cash_account_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.currency, table.currencyMinorUnitDigits],
      foreignColumns: [
        businessSettings.businessId,
        businessSettings.currency,
        businessSettings.currencyMinorUnitDigits,
      ],
      name: "purchase_business_currency_digits_fk",
    }).onDelete("restrict"),
    index("purchase_business_occurred_created_idx").on(
      table.businessId,
      table.occurredAt,
      table.createdAt,
      table.id,
    ),
    index("purchase_business_supplier_occurred_created_idx").on(
      table.businessId,
      table.supplierId,
      table.occurredAt,
      table.createdAt,
      table.id,
    ),
    index("purchase_business_status_due_idx").on(table.businessId, table.status, table.dueDate),
  ],
);

export const purchaseLine = pgTable(
  "purchase_line",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    purchaseId: uuid("purchase_id").notNull(),
    position: smallint("position").notNull(),
    productId: uuid("product_id").notNull(),
    /** The product name when the purchase was recorded, so a later rename keeps the invoice text. */
    productName: text("product_name").notNull(),
    quantityMinorUnits: bigint("quantity_minor_units", { mode: "bigint" }).notNull(),
    quantityPrecision: smallint("quantity_precision").notNull(),
    unitCostMinorUnits: bigint("unit_cost_minor_units", { mode: "bigint" }).notNull(),
    subtotalMinorUnits: bigint("subtotal_minor_units", { mode: "bigint" }).notNull(),
    /** The stock entry of a received line of a tracked product. */
    inventoryMovementId: uuid("inventory_movement_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("purchase_line_position_check", sql`${table.position} between 0 and 49`),
    check(
      "purchase_line_product_name_length_check",
      sql`char_length(${table.productName}) between 1 and 120`,
    ),
    check("purchase_line_quantity_positive_check", sql`${table.quantityMinorUnits} > 0`),
    check("purchase_line_precision_check", sql`${table.quantityPrecision} between 0 and 3`),
    check("purchase_line_unit_cost_check", sql`${table.unitCostMinorUnits} >= 0`),
    check("purchase_line_subtotal_check", sql`${table.subtotalMinorUnits} >= 0`),
    unique("purchase_line_business_purchase_position_unique").on(
      table.businessId,
      table.purchaseId,
      table.position,
    ),
    uniqueIndex("purchase_line_inventory_movement_unique")
      .on(table.inventoryMovementId)
      .where(sql`${table.inventoryMovementId} is not null`),
    foreignKey({
      columns: [table.businessId, table.purchaseId],
      foreignColumns: [purchase.businessId, purchase.id],
      name: "purchase_line_business_purchase_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.productId],
      foreignColumns: [catalogProduct.businessId, catalogProduct.id],
      name: "purchase_line_business_product_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.productId, table.inventoryMovementId],
      foreignColumns: [
        inventoryMovement.businessId,
        inventoryMovement.productId,
        inventoryMovement.id,
      ],
      name: "purchase_line_inventory_movement_fk",
    }).onDelete("restrict"),
    index("purchase_line_business_product_idx").on(table.businessId, table.productId),
  ],
);

export const supplierPayment = pgTable(
  "supplier_payment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    purchaseId: uuid("purchase_id").notNull(),
    supplierId: uuid("supplier_id").notNull(),
    cashAccountId: uuid("cash_account_id").notNull(),
    amountMinorUnits: bigint("amount_minor_units", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    currencyMinorUnitDigits: smallint("currency_minor_unit_digits").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    occurredLocalDate: text("occurred_local_date").notNull(),
    occurredLocalTime: text("occurred_local_time").notNull(),
    timeZone: text("time_zone").notNull(),
    reference: text("reference"),
    entrySource: text("entry_source").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("supplier_payment_amount_positive_check", sql`${table.amountMinorUnits} > 0`),
    check("supplier_payment_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "supplier_payment_currency_digits_check",
      sql`${table.currencyMinorUnitDigits} between 0 and 4`,
    ),
    check(
      "supplier_payment_local_date_check",
      sql`${table.occurredLocalDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`,
    ),
    check("supplier_payment_local_time_check", sql`${table.occurredLocalTime} ~ '^\\d{2}:\\d{2}$'`),
    check(
      "supplier_payment_time_zone_length_check",
      sql`char_length(${table.timeZone}) between 1 and 64`,
    ),
    check(
      "supplier_payment_reference_length_check",
      sql`${table.reference} is null or char_length(${table.reference}) between 1 and 120`,
    ),
    check(
      "supplier_payment_entry_source_check",
      sql`${table.entrySource} in ('manual', 'voice', 'text')`,
    ),
    unique("supplier_payment_business_id_id_unique").on(table.businessId, table.id),
    unique("supplier_payment_business_purchase_id_unique").on(
      table.businessId,
      table.purchaseId,
      table.id,
    ),
    foreignKey({
      columns: [table.businessId, table.supplierId, table.purchaseId],
      foreignColumns: [purchase.businessId, purchase.supplierId, purchase.id],
      name: "supplier_payment_business_purchase_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.cashAccountId],
      foreignColumns: [cashAccount.businessId, cashAccount.id],
      name: "supplier_payment_business_cash_account_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.currency, table.currencyMinorUnitDigits],
      foreignColumns: [
        businessSettings.businessId,
        businessSettings.currency,
        businessSettings.currencyMinorUnitDigits,
      ],
      name: "supplier_payment_business_currency_digits_fk",
    }).onDelete("restrict"),
    index("supplier_payment_business_purchase_occurred_created_idx").on(
      table.businessId,
      table.purchaseId,
      table.occurredAt,
      table.createdAt,
      table.id,
    ),
    index("supplier_payment_cash_account_idx").on(table.businessId, table.cashAccountId),
  ],
);

export const purchaseOperation = pgTable(
  "purchase_operation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    commandFingerprint: text("command_fingerprint").notNull(),
    action: text("action").notNull(),
    supplierId: uuid("supplier_id").notNull(),
    purchaseId: uuid("purchase_id"),
    paymentId: uuid("payment_id"),
    resultSnapshot: jsonb("result_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "purchase_operation_action_check",
      sql`${table.action} in (
        'supplier.created',
        'supplier.updated',
        'supplier.archived',
        'purchase.posted',
        'purchase.received',
        'purchase.voided',
        'purchase.payment_applied'
      )`,
    ),
    check(
      "purchase_operation_target_shape_check",
      sql`(
        ${table.action} like 'supplier.%'
        and ${table.purchaseId} is null
        and ${table.paymentId} is null
      ) or (
        ${table.action} in ('purchase.posted', 'purchase.received', 'purchase.voided')
        and ${table.purchaseId} is not null
        and ${table.paymentId} is null
      ) or (
        ${table.action} = 'purchase.payment_applied'
        and ${table.purchaseId} is not null
        and ${table.paymentId} is not null
      )`,
    ),
    check(
      "purchase_operation_fingerprint_check",
      sql`${table.commandFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    uniqueIndex("purchase_operation_actor_key_unique").on(
      table.businessId,
      table.actorUserId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businessSettings.businessId],
      name: "purchase_operation_business_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.supplierId],
      foreignColumns: [supplier.businessId, supplier.id],
      name: "purchase_operation_business_supplier_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.supplierId, table.purchaseId],
      foreignColumns: [purchase.businessId, purchase.supplierId, purchase.id],
      name: "purchase_operation_business_purchase_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.purchaseId, table.paymentId],
      foreignColumns: [supplierPayment.businessId, supplierPayment.purchaseId, supplierPayment.id],
      name: "purchase_operation_business_payment_fk",
    }).onDelete("restrict"),
    index("purchase_operation_supplier_idx").on(table.businessId, table.supplierId),
    index("purchase_operation_purchase_idx").on(table.businessId, table.purchaseId),
  ],
);
