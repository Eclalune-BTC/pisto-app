import type { Database } from "./client.ts";
import { createPurchaseCommands } from "./purchases/purchase-commands.ts";
import { createPurchaseQueries } from "./purchases/purchase-queries.ts";
import { createSupplierCommands } from "./purchases/supplier-commands.ts";
import { createSupplierQueries } from "./purchases/supplier-queries.ts";
import type { PurchasesRepository } from "./purchases/types.ts";

export type { PurchasesRepository } from "./purchases/types.ts";

export function createPurchasesRepository(db: Database): PurchasesRepository {
  return {
    ...createSupplierCommands(db),
    ...createSupplierQueries(db),
    ...createPurchaseCommands(db),
    ...createPurchaseQueries(db),
  };
}
