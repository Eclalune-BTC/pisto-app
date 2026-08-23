import { and, eq, sql } from "drizzle-orm";

import { findOperationReplay, lockCommandKey, type OperationLog } from "../operation-log.ts";
import { type ProductActor, ProductError } from "../product.ts";
import { catalogCategory, catalogOperation, inventoryMovement } from "../schema/catalog.ts";
import type { DatabaseExecutor, DatabaseTransaction, OperationAction } from "./types.ts";

export const catalogOperationLog: OperationLog = {
  action: catalogOperation.action,
  actorUserId: catalogOperation.actorUserId,
  businessId: catalogOperation.businessId,
  commandFingerprint: catalogOperation.commandFingerprint,
  conflictMessage: "That confirmation key was already used for a different catalog operation",
  idempotencyKey: catalogOperation.idempotencyKey,
  result: catalogOperation.resultSnapshot,
  table: catalogOperation,
};

export async function lockOperation(
  transaction: DatabaseTransaction,
  actor: ProductActor,
  businessId: string,
  idempotencyKey: string,
  commandFingerprint: string,
  action: OperationAction,
): Promise<Record<string, unknown> | null> {
  const identity = {
    action,
    actorUserId: actor.userId,
    businessId,
    commandFingerprint,
    idempotencyKey,
  };
  await lockCommandKey(transaction, identity);
  // The caller validates the stored snapshot against its public contract.
  return (await findOperationReplay(transaction, catalogOperationLog, identity)) as Record<
    string,
    unknown
  > | null;
}

export async function saveOperation(
  transaction: DatabaseTransaction,
  input: {
    action: OperationAction;
    actor: ProductActor;
    businessId: string;
    categoryId?: string;
    commandFingerprint: string;
    idempotencyKey: string;
    movementId?: string;
    productId?: string;
    resultSnapshot: Record<string, unknown>;
  },
) {
  await transaction.insert(catalogOperation).values({
    action: input.action,
    actorUserId: input.actor.userId,
    businessId: input.businessId,
    categoryId: input.categoryId ?? null,
    commandFingerprint: input.commandFingerprint,
    idempotencyKey: input.idempotencyKey,
    movementId: input.movementId ?? null,
    productId: input.productId ?? null,
    resultSnapshot: input.resultSnapshot,
  });
}

export async function requireActiveCategory(
  transaction: DatabaseTransaction,
  businessId: string,
  categoryId: string,
) {
  const [category] = await transaction
    .select({ id: catalogCategory.id })
    .from(catalogCategory)
    .where(
      and(
        eq(catalogCategory.businessId, businessId),
        eq(catalogCategory.id, categoryId),
        eq(catalogCategory.status, "active"),
      ),
    )
    .limit(1);
  if (!category) {
    throw new ProductError("VALIDATION_ERROR", "The selected category is not active");
  }
}

export async function currentBalance(
  executor: DatabaseExecutor,
  businessId: string,
  productId: string,
): Promise<bigint> {
  const [balance] = await executor
    .select({ value: sql<string>`coalesce(sum(${inventoryMovement.deltaMinorUnits}), 0)::text` })
    .from(inventoryMovement)
    .where(
      and(eq(inventoryMovement.businessId, businessId), eq(inventoryMovement.productId, productId)),
    );
  return BigInt(balance?.value ?? "0");
}
