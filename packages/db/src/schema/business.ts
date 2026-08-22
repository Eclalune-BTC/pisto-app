import { sql } from "drizzle-orm";
import { check, pgTable, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { organization } from "./auth.ts";

export const businessSettings = pgTable(
  "business_settings",
  {
    businessId: text("business_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "restrict" }),
    currency: text("currency").notNull(),
    currencyMinorUnitDigits: smallint("currency_minor_unit_digits").notNull(),
    timeZone: text("time_zone").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("business_settings_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "business_settings_currency_digits_check",
      sql`${table.currencyMinorUnitDigits} between 0 and 4`,
    ),
    check(
      "business_settings_time_zone_length_check",
      sql`char_length(${table.timeZone}) between 1 and 64`,
    ),
    uniqueIndex("business_settings_id_currency_digits_unique").on(
      table.businessId,
      table.currency,
      table.currencyMinorUnitDigits,
    ),
  ],
);
