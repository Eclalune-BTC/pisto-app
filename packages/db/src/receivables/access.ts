import type { BusinessPermission } from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";
import type { ZodType } from "zod";

import { authorizeBusinessAction } from "../business-access.ts";
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

export async function lockIdempotencyKey(
  tx: DatabaseTransaction,
  actor: ProductActor,
  businessId: string,
  idempotencyKey: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${businessId}:${actor.userId}:${idempotencyKey}`}, 0))`,
  );
}

export async function readOperationSnapshot<T>(input: {
  action: string;
  actor: ProductActor;
  businessId: string;
  fingerprint: string;
  idempotencyKey: string;
  schema: ZodType<T>;
  tx: DatabaseTransaction;
}): Promise<T | null> {
  const [operation] = await input.tx
    .select({
      action: receivableOperation.action,
      commandFingerprint: receivableOperation.commandFingerprint,
      resultSnapshot: receivableOperation.resultSnapshot,
    })
    .from(receivableOperation)
    .where(
      and(
        eq(receivableOperation.businessId, input.businessId),
        eq(receivableOperation.actorUserId, input.actor.userId),
        eq(receivableOperation.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (!operation) return null;
  if (operation.action !== input.action || operation.commandFingerprint !== input.fingerprint) {
    throw new ProductError(
      "IDEMPOTENCY_CONFLICT",
      "That confirmation key was already used for a different operation",
    );
  }
  const snapshot = input.schema.safeParse(operation.resultSnapshot);
  if (!snapshot.success) throw new Error("Stored receivables operation snapshot is invalid");
  return snapshot.data;
}

export async function insertOperation(
  tx: DatabaseTransaction,
  input: {
    action: string;
    actor: ProductActor;
    businessId: string;
    customerId: string;
    fingerprint: string;
    idempotencyKey: string;
    paymentId?: string;
    receivableId?: string;
    resultSnapshot: unknown;
  },
): Promise<void> {
  await tx.insert(receivableOperation).values({
    businessId: input.businessId,
    actorUserId: input.actor.userId,
    idempotencyKey: input.idempotencyKey,
    commandFingerprint: input.fingerprint,
    action: input.action,
    customerId: input.customerId,
    receivableId: input.receivableId ?? null,
    paymentId: input.paymentId ?? null,
    resultSnapshot: input.resultSnapshot,
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
