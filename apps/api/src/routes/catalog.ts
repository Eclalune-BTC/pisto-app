import type { Auth } from "@pisto/auth";
import {
  archiveCategoryRequestSchema,
  archiveProductRequestSchema,
  categoryListQuerySchema,
  createCategoryRequestSchema,
  createProductRequestSchema,
  inventoryMovementListQuerySchema,
  productListQuerySchema,
  recordInventoryMovementRequestSchema,
  reverseInventoryMovementRequestSchema,
  stockListQuerySchema,
  updateCategoryRequestSchema,
  updateProductRequestSchema,
} from "@pisto/contracts";
import type { CatalogRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { Hono } from "hono";
import { z } from "zod";

import { ApiError } from "../errors.ts";
import { parseJsonBody } from "../http.ts";
import { requireSession, toProductActor } from "../session.ts";
import type { AppEnv } from "../types.ts";

const recordIdSchema = z.string().uuid();

function mapCatalogError(error: unknown): never {
  if (!(error instanceof ProductError)) throw error;
  switch (error.code) {
    case "BUSINESS_REQUIRED":
      throw new ApiError(409, "BUSINESS_REQUIRED", error.message);
    case "IDEMPOTENCY_CONFLICT":
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", error.message);
    case "CONFLICT":
      throw new ApiError(409, "CONFLICT", error.message);
    case "FORBIDDEN":
      throw new ApiError(403, "FORBIDDEN", error.message);
    case "NOT_FOUND":
      throw new ApiError(404, "NOT_FOUND", error.message);
    case "UNAUTHORIZED":
      throw new ApiError(401, "UNAUTHORIZED", error.message);
    case "VALIDATION_ERROR":
      throw new ApiError(400, "VALIDATION_ERROR", error.message);
  }
}

function parseRecordId(value: string, message: string): string {
  const result = recordIdSchema.safeParse(value);
  if (!result.success) throw new ApiError(404, "NOT_FOUND", message);
  return result.data;
}

function queryObject(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

export function catalogRoutes(input: { auth: Auth; catalog: CatalogRepository }) {
  const routes = new Hono<AppEnv>();

  routes.get("/catalog/categories", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const query = categoryListQuerySchema.safeParse(queryObject(context.req.url));
    if (!query.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Category query is invalid",
        query.error.flatten(),
      );
    }
    try {
      return context.json({
        data: await input.catalog.listCategories(toProductActor(authSession), query.data),
      });
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.post("/catalog/categories", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const body = createCategoryRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Category command is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.catalog.createCategory(toProductActor(authSession), body.data);
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.patch("/catalog/categories/:categoryId", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const categoryId = parseRecordId(context.req.param("categoryId"), "Category was not found");
    const body = updateCategoryRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Category command is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.catalog.updateCategory(
        toProductActor(authSession),
        categoryId,
        body.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.post("/catalog/categories/:categoryId/archive", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const categoryId = parseRecordId(context.req.param("categoryId"), "Category was not found");
    const body = archiveCategoryRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Category archive command is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.catalog.archiveCategory(
        toProductActor(authSession),
        categoryId,
        body.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.get("/catalog/products", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const query = productListQuerySchema.safeParse(queryObject(context.req.url));
    if (!query.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Product query is invalid",
        query.error.flatten(),
      );
    }
    try {
      return context.json({
        data: await input.catalog.listProducts(toProductActor(authSession), query.data),
      });
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.post("/catalog/products", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const body = createProductRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Product command is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.catalog.createProduct(toProductActor(authSession), body.data);
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.get("/catalog/products/:productId", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const productId = parseRecordId(context.req.param("productId"), "Product was not found");
    try {
      return context.json({
        data: await input.catalog.getProduct(toProductActor(authSession), productId),
      });
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.patch("/catalog/products/:productId", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const productId = parseRecordId(context.req.param("productId"), "Product was not found");
    const body = updateProductRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Product command is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.catalog.updateProduct(
        toProductActor(authSession),
        productId,
        body.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.post("/catalog/products/:productId/archive", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const productId = parseRecordId(context.req.param("productId"), "Product was not found");
    const body = archiveProductRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Product archive command is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.catalog.archiveProduct(
        toProductActor(authSession),
        productId,
        body.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.get("/inventory/stock", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const query = stockListQuerySchema.safeParse(queryObject(context.req.url));
    if (!query.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Stock query is invalid", query.error.flatten());
    }
    try {
      return context.json({
        data: await input.catalog.listStock(toProductActor(authSession), query.data),
      });
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.get("/inventory/products/:productId/movements", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const productId = parseRecordId(context.req.param("productId"), "Product was not found");
    const query = inventoryMovementListQuerySchema.safeParse(queryObject(context.req.url));
    if (!query.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Movement query is invalid",
        query.error.flatten(),
      );
    }
    try {
      return context.json({
        data: await input.catalog.listMovements(toProductActor(authSession), productId, query.data),
      });
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.post("/inventory/products/:productId/movements", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const productId = parseRecordId(context.req.param("productId"), "Product was not found");
    const body = recordInventoryMovementRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Movement command is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.catalog.recordMovement(
        toProductActor(authSession),
        productId,
        body.data,
      );
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  routes.post("/inventory/movements/:movementId/reverse", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const movementId = parseRecordId(
      context.req.param("movementId"),
      "Inventory movement was not found",
    );
    const body = reverseInventoryMovementRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Reversal command is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.catalog.reverseMovement(
        toProductActor(authSession),
        movementId,
        body.data,
      );
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapCatalogError(error);
    }
  });

  return routes;
}
