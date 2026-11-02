import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { catalogProduct } from "./catalog.ts";
import { sale } from "./sales.ts";

/**
 * One product line of an itemized sale. The name, quantity precision and price are what the sale
 * charged, so later catalog edits do not rewrite it.
 */
export const saleLine = pgTable(
  "sale_line",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    saleId: uuid("sale_id").notNull(),
    lineNumber: smallint("line_number").notNull(),
    productId: uuid("product_id").notNull(),
    productName: text("product_name").notNull(),
    quantityMinorUnits: bigint("quantity_minor_units", { mode: "bigint" }).notNull(),
    quantityPrecision: smallint("quantity_precision").notNull(),
    unitPriceMinorUnits: bigint("unit_price_minor_units", { mode: "bigint" }).notNull(),
    subtotalMinorUnits: bigint("subtotal_minor_units", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check("sale_line_number_check", sql`${table.lineNumber} between 1 and 50`),
    check("sale_line_product_name_check", sql`char_length(${table.productName}) between 1 and 120`),
    check("sale_line_quantity_positive_check", sql`${table.quantityMinorUnits} > 0`),
    check("sale_line_precision_check", sql`${table.quantityPrecision} between 0 and 3`),
    check("sale_line_unit_price_check", sql`${table.unitPriceMinorUnits} >= 0`),
    check("sale_line_subtotal_check", sql`${table.subtotalMinorUnits} >= 0`),
    foreignKey({
      columns: [table.businessId, table.saleId],
      foreignColumns: [sale.businessId, sale.id],
      name: "sale_line_business_sale_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.businessId, table.productId],
      foreignColumns: [catalogProduct.businessId, catalogProduct.id],
      name: "sale_line_business_product_fk",
    }).onDelete("restrict"),
    uniqueIndex("sale_line_sale_number_unique").on(
      table.businessId,
      table.saleId,
      table.lineNumber,
    ),
    uniqueIndex("sale_line_sale_product_unique").on(
      table.businessId,
      table.saleId,
      table.productId,
    ),
  ],
);
