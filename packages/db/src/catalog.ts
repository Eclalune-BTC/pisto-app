import { createCategoryCommands } from "./catalog/category-commands.ts";
import { createInventoryCommands } from "./catalog/inventory-commands.ts";
import { createProductCommands } from "./catalog/product-commands.ts";
import { createCatalogQueries } from "./catalog/queries.ts";
import type { CatalogRepository } from "./catalog/types.ts";
import type { Database } from "./client.ts";

export type { CatalogRepository } from "./catalog/types.ts";

export function createCatalogRepository(db: Database): CatalogRepository {
  return {
    ...createCatalogQueries(db),
    ...createCategoryCommands(db),
    ...createProductCommands(db),
    ...createInventoryCommands(db),
  };
}
