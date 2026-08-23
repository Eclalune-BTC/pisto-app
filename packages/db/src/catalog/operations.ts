import { and, eq, sql } from "drizzle-orm";

import { lockCommandKey } from "../operation-log.ts";
import { type ProductActor, ProductError } from "../product.ts";
import { catalogCategory, catalogOperation, inventoryMovement } from "../schema/catalog.ts";
import type { DatabaseExecutor, DatabaseTransaction, OperationAction } from "./types.ts";

export async function lockOperation(
  transaction: DatabaseTransaction,
  actor: ProductActor,
  businessId: string,
  idempotencyKey: string,
  commandFingerprint: string,
): Promise<Record<string, unknown> | null> {
  await lockCommandKey(transaction, { actorUserId: actor.userId, businessId, idempotencyKey });
  const [existing] = await transaction
    .select({
      commandFingerprint: catalogOperation.commandFingerprint,
      resultSnapshot: catalogOperation.resultSnapshot,
    })
    .from(catalogOperation)
    .where(
      and(
        eq(catalogOperation.businessId, businessId),
        eq(catalogOperation.actorUserId, actor.userId),
        eq(catalogOperation.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  if (!existing) return null;
  if (existing.commandFingerprint !== commandFingerprint) {
    throw new ProductError(
      "IDEMPOTENCY_CONFLICT",
      "That confirmation key was already used for a different catalog operation",
    );
  }
  return existing.resultSnapshot;
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
