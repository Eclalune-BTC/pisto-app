import {
  categoryListQuerySchema,
  inventoryMovementListQuerySchema,
  productListQuerySchema,
  stockListQuerySchema,
} from "@pisto/contracts";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { authorizeBusinessAction } from "../business-access.ts";
import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import {
  decodeCursor,
  exactCursorTimestamp,
  keysetBefore,
  listFilterFingerprint,
  pageRows,
} from "../pagination.ts";
import { catalogCategory, catalogProduct, inventoryMovement } from "../schema/catalog.ts";
import { correlatedSubquery } from "../subquery.ts";
import { containsText } from "../text-search.ts";
import { stockFor, toCategory, toMovement, toProduct, trackedStockFor } from "./mappers.ts";
import { onHandQuantity } from "./records.ts";
import type { CatalogQueries } from "./types.ts";

const reversal = alias(inventoryMovement, "reversal");

/**
 * The reversal of the `inventory_movement` row in the enclosing query, if any. An
 * alias renders as its bare name inside raw SQL, so the FROM names the table too.
 */
function reversedByMovementId() {
  return correlatedSubquery<string | null>(sql`(
    select ${reversal.id}::text
    from ${inventoryMovement} ${reversal}
    where ${reversal.businessId} = ${inventoryMovement.businessId}
      and ${reversal.productId} = ${inventoryMovement.productId}
      and ${reversal.reversesMovementId} = ${inventoryMovement.id}
    limit 1
  )`);
}

function productRow() {
  return {
    ...getTableColumns(catalogProduct),
    createdAtExact: exactCursorTimestamp(catalogProduct.createdAt),
    onHandMinorUnits: sql<string>`${onHandQuantity()}::text`,
  };
}

export function createCatalogQueries(db: Database): CatalogQueries {
  return {
    async listCategories(actor, rawQuery) {
      const query = parseInput(categoryListQuerySchema, rawQuery, "Category query is invalid");
      const filterFingerprint = await listFilterFingerprint("categories", {
        search: query.search ?? null,
        status: query.status,
      });
      const cursor = decodeCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["catalog:read"]);
        const rows = await tx
          .select({
            ...getTableColumns(catalogCategory),
            createdAtExact: exactCursorTimestamp(catalogCategory.createdAt),
          })
          .from(catalogCategory)
          .where(
            and(
              eq(catalogCategory.businessId, access.businessId),
              query.status === "all" ? undefined : eq(catalogCategory.status, query.status),
              query.search ? containsText([catalogCategory.name], query.search) : undefined,
              keysetBefore(catalogCategory, cursor),
            ),
          )
          .orderBy(desc(catalogCategory.createdAt), desc(catalogCategory.id))
          .limit(query.limit + 1);
        const page = pageRows(rows, query.limit, filterFingerprint);
        return { items: page.rows.map(toCategory), nextCursor: page.nextCursor };
      });
    },

    async listProducts(actor, rawQuery) {
      const query = parseInput(productListQuerySchema, rawQuery, "Product query is invalid");
      const filterFingerprint = await listFilterFingerprint("products", {
        categoryId: query.categoryId ?? null,
        search: query.search ?? null,
        status: query.status,
      });
      const cursor = decodeCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["catalog:read"]);
        const rows = await tx
          .select(productRow())
          .from(catalogProduct)
          .where(
            and(
              eq(catalogProduct.businessId, access.businessId),
              query.status === "all" ? undefined : eq(catalogProduct.status, query.status),
              query.categoryId ? eq(catalogProduct.categoryId, query.categoryId) : undefined,
              query.search
                ? containsText([catalogProduct.name, catalogProduct.sku], query.search)
                : undefined,
              keysetBefore(catalogProduct, cursor),
            ),
          )
          .orderBy(desc(catalogProduct.createdAt), desc(catalogProduct.id))
          .limit(query.limit + 1);
        const page = pageRows(rows, query.limit, filterFingerprint);
        return {
          items: page.rows.map((record) => ({
            product: toProduct(record),
            stock: stockFor(record, record.onHandMinorUnits),
          })),
          nextCursor: page.nextCursor,
        };
      });
    },

    async getProduct(actor, productId) {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["catalog:read"]);
        const [record] = await tx
          .select(productRow())
          .from(catalogProduct)
          .where(
            and(eq(catalogProduct.businessId, access.businessId), eq(catalogProduct.id, productId)),
          )
          .limit(1);
        if (!record) throw new ProductError("NOT_FOUND", "Product was not found");
        return { product: toProduct(record), stock: stockFor(record, record.onHandMinorUnits) };
      });
    },

    async listStock(actor, rawQuery) {
      const query = parseInput(stockListQuerySchema, rawQuery, "Stock query is invalid");
      const filterFingerprint = await listFilterFingerprint("stock", {
        lowStockOnly: query.lowStockOnly,
        search: query.search ?? null,
      });
      const cursor = decodeCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["inventory:read"]);
        const rows = await tx
          .select(productRow())
          .from(catalogProduct)
          .where(
            and(
              eq(catalogProduct.businessId, access.businessId),
              eq(catalogProduct.status, "active"),
              eq(catalogProduct.tracked, true),
              query.search
                ? containsText([catalogProduct.name, catalogProduct.sku], query.search)
                : undefined,
              query.lowStockOnly
                ? sql`${catalogProduct.lowStockThresholdMinorUnits} is not null
                    and ${onHandQuantity()} <= ${catalogProduct.lowStockThresholdMinorUnits}`
                : undefined,
              keysetBefore(catalogProduct, cursor),
            ),
          )
          .orderBy(desc(catalogProduct.createdAt), desc(catalogProduct.id))
          .limit(query.limit + 1);
        const page = pageRows(rows, query.limit, filterFingerprint);
        return {
          items: page.rows.map((record) => ({
            product: toProduct(record),
            stock: trackedStockFor(record, record.onHandMinorUnits),
          })),
          nextCursor: page.nextCursor,
        };
      });
    },

    async listMovements(actor, productId, rawQuery) {
      const query = parseInput(
        inventoryMovementListQuerySchema,
        rawQuery,
        "Movement query is invalid",
      );
      const filterFingerprint = await listFilterFingerprint("inventory-movements", { productId });
      const cursor = decodeCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["inventory:read"]);
        const [product] = await tx
          .select({ id: catalogProduct.id })
          .from(catalogProduct)
          .where(
            and(eq(catalogProduct.businessId, access.businessId), eq(catalogProduct.id, productId)),
          )
          .limit(1);
        if (!product) throw new ProductError("NOT_FOUND", "Product was not found");
        const rows = await tx
          .select({
            ...getTableColumns(inventoryMovement),
            createdAtExact: exactCursorTimestamp(inventoryMovement.createdAt),
            reversedByMovementId: reversedByMovementId(),
          })
          .from(inventoryMovement)
          .where(
            and(
              eq(inventoryMovement.businessId, access.businessId),
              eq(inventoryMovement.productId, productId),
              keysetBefore(inventoryMovement, cursor),
            ),
          )
          .orderBy(desc(inventoryMovement.createdAt), desc(inventoryMovement.id))
          .limit(query.limit + 1);
        const page = pageRows(rows, query.limit, filterFingerprint);
        return {
          items: page.rows.map((record) => toMovement(record, record.reversedByMovementId)),
          nextCursor: page.nextCursor,
        };
      });
    },
  };
}
