import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.ts";
import { businessSettings } from "./business.ts";

/**
 * Receipts of the owner's staff commands. `member_id` has no foreign key: a removal deletes the
 * membership row, and its receipt must outlive it.
 */
export const businessMemberOperation = pgTable(
  "business_member_operation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: text("business_id").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    commandFingerprint: text("command_fingerprint").notNull(),
    action: text("action").notNull(),
    memberId: text("member_id").notNull(),
    resultSnapshot: jsonb("result_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "business_member_operation_action_check",
      sql`${table.action} in ('member.added', 'member.role_changed', 'member.removed')`,
    ),
    check(
      "business_member_operation_fingerprint_check",
      sql`${table.commandFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    uniqueIndex("business_member_operation_actor_key_unique").on(
      table.businessId,
      table.actorUserId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businessSettings.businessId],
      name: "business_member_operation_business_fk",
    }).onDelete("restrict"),
  ],
);

/**
 * Written when an add-member command finds no account for its email, before the account is
 * created outside the transaction. A retry after a partial failure, or a concurrent duplicate of
 * the same command, then still reports the account as created by this command, and a retry whose
 * fingerprint differs (another password or email under the key) is refused.
 */
export const businessMemberAccountIntent = pgTable(
  "business_member_account_intent",
  {
    businessId: text("business_id").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    email: text("email").notNull(),
    commandFingerprint: text("command_fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "business_member_account_intent_fingerprint_check",
      sql`${table.commandFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    primaryKey({
      columns: [table.businessId, table.actorUserId, table.idempotencyKey],
      name: "business_member_account_intent_pk",
    }),
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businessSettings.businessId],
      name: "business_member_account_intent_business_fk",
    }).onDelete("restrict"),
  ],
);
