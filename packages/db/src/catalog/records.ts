import { and, eq, sql } from "drizzle-orm";

import type { BusinessDatabaseExecutor, DatabaseTransaction } from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { sumLedger } from "../money.ts";
import type { OperationLog } from "../operation-log.ts";
import {
  catalogCategory,
  catalogOperation,
  catalogProduct,
  inventoryMovement,
} from "../schema/catalog.ts";
import { correlatedSubquery } from "../subquery.ts";

export const catalogOperationLog = {
  conflictMessage: "That confirmation key was already used for a different catalog operation",
  result: catalogOperation.resultSnapshot,
  table: catalogOperation,
} satisfies OperationLog<typeof catalogOperation>;

/**
 * FOR SHARE conflicts with the row update of a concurrent archive, so a product cannot
 * be assigned to a category whose archive commits in between. The foreign-key check's
 * FOR KEY SHARE alone would not conflict with a status-only update.
 */
export async function requireActiveCategory(
  tx: DatabaseTransaction,
  businessId: string,
  categoryId: string,
): Promise<void> {
  const [category] = await tx
    .select({ id: catalogCategory.id })
    .from(catalogCategory)
    .where(
      and(
        eq(catalogCategory.businessId, businessId),
        eq(catalogCategory.id, categoryId),
        eq(catalogCategory.status, "active"),
      ),
    )
    .limit(1)
    .for("share");
  if (!category) {
    throw new ProductError("VALIDATION_ERROR", "The selected category is not active");
  }
}

export function currentBalance(
  executor: BusinessDatabaseExecutor,
  businessId: string,
  productId: string,
): Promise<bigint> {
  return sumLedger(
    executor,
    {
      table: inventoryMovement,
      amount: inventoryMovement.deltaMinorUnits,
      where: and(
        eq(inventoryMovement.businessId, businessId),
        eq(inventoryMovement.productId, productId),
      ),
    },
    "Inventory balance",
  );
}

export function onHandQuantity() {
  return correlatedSubquery<string>(sql`coalesce((
    select sum(${inventoryMovement.deltaMinorUnits})
    from ${inventoryMovement}
    where ${inventoryMovement.businessId} = ${catalogProduct.businessId}
      and ${inventoryMovement.productId} = ${catalogProduct.id}
  ), 0)`);
}
