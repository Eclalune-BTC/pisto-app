import type { BusinessPermission } from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";

import {
  beginOperation,
  type OperationCommandIdentity,
  type OperationLog,
  operationIdentityValues,
} from "../operation-log.ts";
import { type ProductActor, ProductError } from "../product.ts";
import { catalogCategory, catalogOperation, inventoryMovement } from "../schema/catalog.ts";
import type {
  AuthorizedBusiness,
  DatabaseExecutor,
  DatabaseTransaction,
  OperationAction,
} from "./types.ts";

export const catalogOperationLog = {
  conflictMessage: "That confirmation key was already used for a different catalog operation",
  result: catalogOperation.resultSnapshot,
  table: catalogOperation,
} satisfies OperationLog<typeof catalogOperation>;

/** Authorizes the actor, takes the idempotency lock, and reads any stored replay. */
export async function beginCatalogOperation(
  transaction: DatabaseTransaction,
  actor: ProductActor,
  permission: BusinessPermission,
  command: {
    action: OperationAction;
    commandFingerprint: string;
    idempotencyKey: string;
  },
): Promise<{
  access: AuthorizedBusiness;
  identity: OperationCommandIdentity<OperationAction>;
  replay: Record<string, unknown> | null;
}> {
  const { access, identity, replay } = await beginOperation(transaction, {
    action: command.action,
    actor,
    commandFingerprint: command.commandFingerprint,
    idempotencyKey: command.idempotencyKey,
    lock: "update",
    log: catalogOperationLog,
    permissions: [permission],
  });
  return { access, identity, replay: replay === null ? null : replay.result };
}

export async function saveOperation(
  transaction: DatabaseTransaction,
  identity: OperationCommandIdentity<OperationAction>,
  target: {
    categoryId?: string;
    movementId?: string;
    productId?: string;
    resultSnapshot: Record<string, unknown>;
  },
) {
  await transaction.insert(catalogOperation).values({
    ...operationIdentityValues(identity),
    categoryId: target.categoryId ?? null,
    movementId: target.movementId ?? null,
    productId: target.productId ?? null,
    resultSnapshot: target.resultSnapshot,
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
