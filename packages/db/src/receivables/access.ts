import type { BusinessPermission } from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";
import type { ZodType } from "zod";

import { authorizeBusinessAction } from "../business-access.ts";
import {
  beginOperation,
  type OperationCommandIdentity,
  type OperationLog,
  operationIdentityValues,
  parseReplaySnapshot,
} from "../operation-log.ts";
import { type ProductActor, ProductError } from "../product.ts";
import { receivable, receivableOperation, receivablePayment } from "../schema/receivables.ts";
import { toReceivable } from "./mappers.ts";
import type { AccessContext, DatabaseTransaction, ReceivableRecord } from "./types.ts";

export async function authorize(
  tx: DatabaseTransaction,
  actor: ProductActor,
  permission: BusinessPermission | readonly BusinessPermission[],
): Promise<AccessContext> {
  const permissions = Array.isArray(permission) ? permission : [permission];
  return authorizeBusinessAction(tx, actor, permissions, "share");
}

export const receivableOperationLog = {
  action: receivableOperation.action,
  actorUserId: receivableOperation.actorUserId,
  businessId: receivableOperation.businessId,
  commandFingerprint: receivableOperation.commandFingerprint,
  conflictMessage: "That confirmation key was already used for a different operation",
  idempotencyKey: receivableOperation.idempotencyKey,
  result: receivableOperation.resultSnapshot,
  table: receivableOperation,
} satisfies OperationLog;

/**
 * Authorizes the actor, takes the idempotency lock, and reads any stored replay
 * back through the contract that produced it.
 */
export async function beginReceivableOperation<T>(
  tx: DatabaseTransaction,
  actor: ProductActor,
  permission: BusinessPermission | readonly BusinessPermission[],
  command: {
    action: string;
    fingerprint: string;
    idempotencyKey: string;
    schema: ZodType<T>;
  },
): Promise<{ access: AccessContext; identity: OperationCommandIdentity; replay: T | null }> {
  const permissions = Array.isArray(permission) ? permission : [permission];
  const { access, identity, replay } = await beginOperation(tx, {
    action: command.action,
    actor,
    commandFingerprint: command.fingerprint,
    idempotencyKey: command.idempotencyKey,
    lock: "share",
    log: receivableOperationLog,
    permissions,
  });
  return {
    access,
    identity,
    replay:
      replay === null
        ? null
        : parseReplaySnapshot(
            command.schema,
            replay.result,
            "Stored receivables operation snapshot is invalid",
          ),
  };
}

export async function insertOperation(
  tx: DatabaseTransaction,
  identity: OperationCommandIdentity,
  target: {
    customerId: string;
    paymentId?: string;
    receivableId?: string;
    resultSnapshot: unknown;
  },
): Promise<void> {
  await tx.insert(receivableOperation).values({
    ...operationIdentityValues(identity),
    customerId: target.customerId,
    receivableId: target.receivableId ?? null,
    paymentId: target.paymentId ?? null,
    resultSnapshot: target.resultSnapshot,
  });
}

export async function getBusinessLocalDate(
  tx: DatabaseTransaction,
  access: AccessContext,
): Promise<string> {
  const [clock] = await tx.execute<{ local_date: string }>(sql`
    select to_char(transaction_timestamp() at time zone ${access.timeZone}, 'YYYY-MM-DD') as local_date
  `);
  if (!clock) throw new Error("Database clock returned no row");
  return clock.local_date;
}

export async function getPaidMinorUnits(
  tx: DatabaseTransaction,
  businessId: string,
  receivableId: string,
): Promise<bigint> {
  const [row] = await tx
    .select({
      paid: sql<string>`coalesce(sum(case when ${receivablePayment.kind} = 'payment' then ${receivablePayment.amountMinorUnits} else -${receivablePayment.amountMinorUnits} end), 0::numeric)::text`,
    })
    .from(receivablePayment)
    .where(
      and(
        eq(receivablePayment.businessId, businessId),
        eq(receivablePayment.receivableId, receivableId),
      ),
    );
  return BigInt(row?.paid ?? "0");
}

export async function loadReceivable(
  tx: DatabaseTransaction,
  access: AccessContext,
  receivableId: string,
  lock = false,
): Promise<ReceivableRecord> {
  const query = tx
    .select()
    .from(receivable)
    .where(and(eq(receivable.businessId, access.businessId), eq(receivable.id, receivableId)))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  const record = records[0];
  if (!record) throw new ProductError("NOT_FOUND", "Receivable was not found");
  return record;
}

export async function currentReceivable(
  tx: DatabaseTransaction,
  access: AccessContext,
  record: ReceivableRecord,
) {
  const [paidMinorUnits, localDate] = await Promise.all([
    getPaidMinorUnits(tx, access.businessId, record.id),
    getBusinessLocalDate(tx, access),
  ]);
  return toReceivable(record, paidMinorUnits, localDate);
}
