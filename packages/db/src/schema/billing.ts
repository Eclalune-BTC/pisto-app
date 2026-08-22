import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth.ts";

export const billingWebhookEvent = pgTable(
  "billing_webhook_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("billing_webhook_event_provider_key_unique").on(table.provider, table.eventKey),
    index("billing_webhook_event_type_idx").on(table.eventType),
    index("billing_webhook_event_created_at_idx").on(table.createdAt),
  ],
);

export const billingCustomer = pgTable(
  "billing_customer",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    providerCustomerId: text("provider_customer_id").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    email: text("email"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("billing_customer_provider_customer_unique").on(
      table.provider,
      table.providerCustomerId,
    ),
    uniqueIndex("billing_customer_provider_user_unique")
      .on(table.provider, table.userId)
      .where(sql`${table.userId} is not null`),
  ],
);

export const billingSubscription = pgTable(
  "billing_subscription",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    providerCustomerId: text("provider_customer_id"),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    productId: text("product_id").notNull(),
    status: text("status").notNull(),
    sourceEventAt: timestamp("source_event_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
      mode: "date",
    }),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
      mode: "date",
    }),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("billing_subscription_provider_id_unique").on(
      table.provider,
      table.providerSubscriptionId,
    ),
    index("billing_subscription_user_id_idx").on(table.userId),
    index("billing_subscription_organization_id_idx").on(table.organizationId),
    index("billing_subscription_status_idx").on(table.status),
  ],
);

export const entitlement = pgTable(
  "entitlement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    productId: text("product_id"),
    status: text("status").notNull(),
    sourceEventAt: timestamp("source_event_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }),
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "date" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "entitlement_exactly_one_subject_check",
      sql`num_nonnulls(${table.userId}, ${table.organizationId}) = 1`,
    ),
    uniqueIndex("entitlement_source_id_key_unique").on(table.source, table.sourceId, table.key),
    index("entitlement_user_status_idx").on(table.userId, table.status),
    index("entitlement_organization_status_idx").on(table.organizationId, table.status),
  ],
);
