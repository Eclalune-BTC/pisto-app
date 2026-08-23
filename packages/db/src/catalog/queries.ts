import {
  categoryListQuerySchema,
  inventoryMovementListQuerySchema,
  productListQuerySchema,
  stockListQuerySchema,
} from "@pisto/contracts";
import { and, desc, eq, or, sql } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError } from "../product.ts";
import { likePattern } from "../product-core.ts";
import { catalogCategory, catalogProduct, inventoryMovement } from "../schema/catalog.ts";
import { authorizeCatalogAction } from "./access.ts";
import {
  cursorCondition,
  decodeCursor,
  pageRows,
  stockFor,
  toCategory,
  toMovement,
  toProduct,
} from "./codec.ts";
import type { CatalogQueries } from "./types.ts";

export function createCatalogQueries(db: Database): CatalogQueries {
  return {
    async listCategories(actor, inputQuery) {
      const parsed = categoryListQuerySchema.safeParse(inputQuery);
      if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Category query is invalid");
      const query = parsed.data;
      const cursor = decodeCursor(query.cursor, "category");
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "catalog:read", "share");
        const rows = await transaction
          .select()
          .from(catalogCategory)
          .where(
            and(
              eq(catalogCategory.businessId, access.businessId),
              query.status === "all" ? undefined : eq(catalogCategory.status, query.status),
              query.search
                ? sql`${catalogCategory.name} ilike ${likePattern(query.search)} escape '\\'`
                : undefined,
              cursorCondition(catalogCategory, cursor),
            ),
          )
          .orderBy(desc(catalogCategory.createdAt), desc(catalogCategory.id))
          .limit(query.limit + 1);
        const page = pageRows(rows, query.limit, "category");
        return { items: page.rows.map(toCategory), nextCursor: page.nextCursor };
      });
    },

    async listProducts(actor, inputQuery) {
      const parsed = productListQuerySchema.safeParse(inputQuery);
      if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Product query is invalid");
      const query = parsed.data;
      const cursor = decodeCursor(query.cursor, "product");
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "catalog:read", "share");
        const rows = await transaction
          .select({
            balance: sql<string>`coalesce((
              select sum(m.delta_minor_units)
              from inventory_movement m
              where m.business_id = ${catalogProduct.businessId}
                and m.product_id = ${catalogProduct.id}
            ), 0)::text`,
            record: catalogProduct,
          })
          .from(catalogProduct)
          .where(
            and(
              eq(catalogProduct.businessId, access.businessId),
              query.status === "all" ? undefined : eq(catalogProduct.status, query.status),
              query.categoryId ? eq(catalogProduct.categoryId, query.categoryId) : undefined,
              query.search
                ? or(
                    sql`${catalogProduct.name} ilike ${likePattern(query.search)} escape '\\'`,
                    sql`${catalogProduct.sku} ilike ${likePattern(query.search)} escape '\\'`,
                  )
                : undefined,
              cursorCondition(catalogProduct, cursor),
            ),
          )
          .orderBy(desc(catalogProduct.createdAt), desc(catalogProduct.id))
          .limit(query.limit + 1);
        const page = pageRows(
          rows.map(({ balance, record }) => ({ ...record, balance })),
          query.limit,
          "product",
        );
        return {
          items: page.rows.map((record) => ({
            product: toProduct(record),
            stock: stockFor(record, record.balance),
          })),
          nextCursor: page.nextCursor,
        };
      });
    },

    async getProduct(actor, productId) {
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "catalog:read", "share");
        const [row] = await transaction
          .select({
            balance: sql<string>`coalesce((
              select sum(m.delta_minor_units)
              from inventory_movement m
              where m.business_id = ${catalogProduct.businessId}
                and m.product_id = ${catalogProduct.id}
            ), 0)::text`,
            record: catalogProduct,
          })
          .from(catalogProduct)
          .where(
            and(eq(catalogProduct.businessId, access.businessId), eq(catalogProduct.id, productId)),
          )
          .limit(1);
        if (!row) throw new ProductError("NOT_FOUND", "Product was not found");
        return { product: toProduct(row.record), stock: stockFor(row.record, row.balance) };
      });
    },

    async listStock(actor, inputQuery) {
      const parsed = stockListQuerySchema.safeParse(inputQuery);
      if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Stock query is invalid");
      const query = parsed.data;
      const cursor = decodeCursor(query.cursor, "stock");
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "inventory:read", "share");
        const balanceExpression = sql<string>`coalesce((
          select sum(m.delta_minor_units)
          from inventory_movement m
          where m.business_id = ${catalogProduct.businessId}
            and m.product_id = ${catalogProduct.id}
        ), 0)::text`;
        const lowStockCondition = sql`(
          ${catalogProduct.lowStockThresholdMinorUnits} is not null
          and coalesce((
            select sum(m.delta_minor_units)
            from inventory_movement m
            where m.business_id = ${catalogProduct.businessId}
              and m.product_id = ${catalogProduct.id}
          ), 0) <= ${catalogProduct.lowStockThresholdMinorUnits}
        )`;
        const rows = await transaction
          .select({ balance: balanceExpression, record: catalogProduct })
          .from(catalogProduct)
          .where(
            and(
              eq(catalogProduct.businessId, access.businessId),
              eq(catalogProduct.status, "active"),
              eq(catalogProduct.tracked, true),
              query.search
                ? or(
                    sql`${catalogProduct.name} ilike ${likePattern(query.search)} escape '\\'`,
                    sql`${catalogProduct.sku} ilike ${likePattern(query.search)} escape '\\'`,
                  )
                : undefined,
              query.lowStockOnly ? lowStockCondition : undefined,
              cursorCondition(catalogProduct, cursor),
            ),
          )
          .orderBy(desc(catalogProduct.createdAt), desc(catalogProduct.id))
          .limit(query.limit + 1);
        const page = pageRows(
          rows.map(({ balance, record }) => ({ ...record, balance })),
          query.limit,
          "stock",
        );
        return {
          items: page.rows.map((record) => {
            const stock = stockFor(record, record.balance);
            if (!stock) throw new Error("Tracked product did not produce stock state");
            return { product: toProduct(record), stock };
          }),
          nextCursor: page.nextCursor,
        };
      });
    },

    async listMovements(actor, productId, inputQuery) {
      const parsed = inventoryMovementListQuerySchema.safeParse(inputQuery);
      if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Movement query is invalid");
      const query = parsed.data;
      const cursor = decodeCursor(query.cursor, "movement");
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "inventory:read", "share");
        const [product] = await transaction
          .select({ id: catalogProduct.id })
          .from(catalogProduct)
          .where(
            and(eq(catalogProduct.businessId, access.businessId), eq(catalogProduct.id, productId)),
          )
          .limit(1);
        if (!product) throw new ProductError("NOT_FOUND", "Product was not found");
        const rows = await transaction
          .select({
            record: inventoryMovement,
            reversedByMovementId: sql<string | null>`(
              select reversal.id::text
              from inventory_movement reversal
              where reversal.business_id = ${inventoryMovement.businessId}
                and reversal.product_id = ${inventoryMovement.productId}
                and reversal.reverses_movement_id = ${inventoryMovement.id}
              limit 1
            )`,
          })
          .from(inventoryMovement)
          .where(
            and(
              eq(inventoryMovement.businessId, access.businessId),
              eq(inventoryMovement.productId, productId),
              cursorCondition(inventoryMovement, cursor),
            ),
          )
          .orderBy(desc(inventoryMovement.createdAt), desc(inventoryMovement.id))
          .limit(query.limit + 1);
        const page = pageRows(
          rows.map(({ record, reversedByMovementId }) => ({ ...record, reversedByMovementId })),
          query.limit,
          "movement",
        );
        return {
          items: page.rows.map((record) => toMovement(record, record.reversedByMovementId ?? null)),
          nextCursor: page.nextCursor,
        };
      });
    },
  };
}
