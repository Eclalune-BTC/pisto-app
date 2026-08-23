import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
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
    unique("cash_account_business_id_id_unique").on(table.businessId, table.id),
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
