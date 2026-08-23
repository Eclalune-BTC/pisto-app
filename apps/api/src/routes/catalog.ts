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
import { Hono } from "hono";

import { commandStatus, parseJsonBody, parseRequest, requireRecordId } from "../http.ts";
import { requireActor } from "../session.ts";
import type { AppEnv } from "../types.ts";

// Hono's context.req.query() is NOT equivalent to this: it keeps the FIRST of a
// duplicated key rather than the last, drops an empty-name parameter instead of
// forwarding it into the strict() schema, and does not strip a fragment. These
// routes have always read the query this way, so unifying them onto the accessor
// cash uses would have changed real statuses and result pages. The three query
// idioms in this package are therefore deliberately NOT consolidated.
function queryObject(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

const categoryNotFound = "Category was not found";
const productNotFound = "Product was not found";
const movementNotFound = "Inventory movement was not found";

export function catalogRoutes(input: { auth: Auth; catalog: CatalogRepository }) {
  const routes = new Hono<AppEnv>();

  routes.get("/catalog/categories", async (context) => {
    const actor = await requireActor(input.auth, context);
    const query = parseRequest(
      categoryListQuerySchema,
      queryObject(context.req.url),
      "Category query is invalid",
    );
    return context.json({ data: await input.catalog.listCategories(actor, query) });
  });

  routes.post("/catalog/categories", async (context) => {
    const actor = await requireActor(input.auth, context);
    const command = parseRequest(
      createCategoryRequestSchema,
      await parseJsonBody(context),
      "Category command is invalid",
    );
    const result = await input.catalog.createCategory(actor, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.patch("/catalog/categories/:categoryId", async (context) => {
    const actor = await requireActor(input.auth, context);
    const categoryId = requireRecordId(context.req.param("categoryId"), categoryNotFound);
    const command = parseRequest(
      updateCategoryRequestSchema,
      await parseJsonBody(context),
      "Category command is invalid",
    );
    return context.json({ data: await input.catalog.updateCategory(actor, categoryId, command) });
  });

  routes.post("/catalog/categories/:categoryId/archive", async (context) => {
    const actor = await requireActor(input.auth, context);
    const categoryId = requireRecordId(context.req.param("categoryId"), categoryNotFound);
    const command = parseRequest(
      archiveCategoryRequestSchema,
      await parseJsonBody(context),
      "Category archive command is invalid",
    );
    return context.json({ data: await input.catalog.archiveCategory(actor, categoryId, command) });
  });

  routes.get("/catalog/products", async (context) => {
    const actor = await requireActor(input.auth, context);
    const query = parseRequest(
      productListQuerySchema,
      queryObject(context.req.url),
      "Product query is invalid",
    );
    return context.json({ data: await input.catalog.listProducts(actor, query) });
  });

  routes.post("/catalog/products", async (context) => {
    const actor = await requireActor(input.auth, context);
    const command = parseRequest(
      createProductRequestSchema,
      await parseJsonBody(context),
      "Product command is invalid",
    );
    const result = await input.catalog.createProduct(actor, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.get("/catalog/products/:productId", async (context) => {
    const actor = await requireActor(input.auth, context);
    const productId = requireRecordId(context.req.param("productId"), productNotFound);
    return context.json({ data: await input.catalog.getProduct(actor, productId) });
  });

  routes.patch("/catalog/products/:productId", async (context) => {
    const actor = await requireActor(input.auth, context);
    const productId = requireRecordId(context.req.param("productId"), productNotFound);
    const command = parseRequest(
      updateProductRequestSchema,
      await parseJsonBody(context),
      "Product command is invalid",
    );
    return context.json({ data: await input.catalog.updateProduct(actor, productId, command) });
  });

  routes.post("/catalog/products/:productId/archive", async (context) => {
    const actor = await requireActor(input.auth, context);
    const productId = requireRecordId(context.req.param("productId"), productNotFound);
    const command = parseRequest(
      archiveProductRequestSchema,
      await parseJsonBody(context),
      "Product archive command is invalid",
    );
    return context.json({ data: await input.catalog.archiveProduct(actor, productId, command) });
  });

  routes.get("/inventory/stock", async (context) => {
    const actor = await requireActor(input.auth, context);
    const query = parseRequest(
      stockListQuerySchema,
      queryObject(context.req.url),
      "Stock query is invalid",
    );
    return context.json({ data: await input.catalog.listStock(actor, query) });
  });

  routes.get("/inventory/products/:productId/movements", async (context) => {
    const actor = await requireActor(input.auth, context);
    const productId = requireRecordId(context.req.param("productId"), productNotFound);
    const query = parseRequest(
      inventoryMovementListQuerySchema,
      queryObject(context.req.url),
      "Movement query is invalid",
    );
    return context.json({ data: await input.catalog.listMovements(actor, productId, query) });
  });

  routes.post("/inventory/products/:productId/movements", async (context) => {
    const actor = await requireActor(input.auth, context);
    const productId = requireRecordId(context.req.param("productId"), productNotFound);
    const command = parseRequest(
      recordInventoryMovementRequestSchema,
      await parseJsonBody(context),
      "Movement command is invalid",
    );
    const result = await input.catalog.recordMovement(actor, productId, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.post("/inventory/movements/:movementId/reverse", async (context) => {
    const actor = await requireActor(input.auth, context);
    const movementId = requireRecordId(context.req.param("movementId"), movementNotFound);
    const command = parseRequest(
      reverseInventoryMovementRequestSchema,
      await parseJsonBody(context),
      "Reversal command is invalid",
    );
    const result = await input.catalog.reverseMovement(actor, movementId, command);
    return context.json({ data: result }, commandStatus(result));
  });

  return routes;
}
