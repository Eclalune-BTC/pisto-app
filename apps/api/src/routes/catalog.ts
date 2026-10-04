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
import { commandResponse, contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes } from "./protected.ts";

const categoryNotFound = "Category was not found";
const productNotFound = "Product was not found";
const movementNotFound = "Inventory movement was not found";
export function catalogRoutes(input: { access: ProductAccess; catalog: CatalogRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get(
    "/catalog/categories",
    async ({ actor, query }) => {
      return { data: await input.catalog.listCategories(actor, query) };
    },
    { query: contract(categoryListQuerySchema, "Category query is invalid"), queryPolicy: "last" },
  );
  routes.post(
    "/catalog/categories",
    async ({ actor, body }) => {
      return commandResponse(await input.catalog.createCategory(actor, body));
    },
    {
      parse: "json",
      body: contract(createCategoryRequestSchema, "Category command is invalid"),
    },
  );
  routes.patch(
    "/catalog/categories/:categoryId",
    async ({ actor, body, params }) => {
      return { data: await input.catalog.updateCategory(actor, params.categoryId, body) };
    },
    {
      record: { categoryId: categoryNotFound },
      body: contract(updateCategoryRequestSchema, "Category command is invalid"),
    },
  );
  routes.post(
    "/catalog/categories/:categoryId/archive",
    async ({ actor, body, params }) => {
      return { data: await input.catalog.archiveCategory(actor, params.categoryId, body) };
    },
    {
      record: { categoryId: categoryNotFound },
      body: contract(archiveCategoryRequestSchema, "Category archive command is invalid"),
    },
  );
  routes.get(
    "/catalog/products",
    async ({ actor, query }) => {
      return { data: await input.catalog.listProducts(actor, query) };
    },
    { query: contract(productListQuerySchema, "Product query is invalid"), queryPolicy: "last" },
  );
  routes.post(
    "/catalog/products",
    async ({ actor, body }) => {
      return commandResponse(await input.catalog.createProduct(actor, body));
    },
    {
      parse: "json",
      body: contract(createProductRequestSchema, "Product command is invalid"),
    },
  );
  routes.get(
    "/catalog/products/:productId",
    async ({ actor, params }) => {
      return { data: await input.catalog.getProduct(actor, params.productId) };
    },
    { record: { productId: productNotFound } },
  );
  routes.patch(
    "/catalog/products/:productId",
    async ({ actor, body, params }) => {
      return { data: await input.catalog.updateProduct(actor, params.productId, body) };
    },
    {
      record: { productId: productNotFound },
      body: contract(updateProductRequestSchema, "Product command is invalid"),
    },
  );
  routes.post(
    "/catalog/products/:productId/archive",
    async ({ actor, body, params }) => {
      return { data: await input.catalog.archiveProduct(actor, params.productId, body) };
    },
    {
      record: { productId: productNotFound },
      body: contract(archiveProductRequestSchema, "Product archive command is invalid"),
    },
  );
  routes.get(
    "/inventory/stock",
    async ({ actor, query }) => {
      return { data: await input.catalog.listStock(actor, query) };
    },
    { query: contract(stockListQuerySchema, "Stock query is invalid"), queryPolicy: "last" },
  );
  routes.get(
    "/inventory/products/:productId/movements",
    async ({ actor, query, params }) => {
      return { data: await input.catalog.listMovements(actor, params.productId, query) };
    },
    {
      record: { productId: productNotFound },
      query: contract(inventoryMovementListQuerySchema, "Movement query is invalid"),
      queryPolicy: "last",
    },
  );
  routes.post(
    "/inventory/products/:productId/movements",
    async ({ actor, body, params }) => {
      return commandResponse(await input.catalog.recordMovement(actor, params.productId, body));
    },
    {
      record: { productId: productNotFound },
      body: contract(recordInventoryMovementRequestSchema, "Movement command is invalid"),
    },
  );
  routes.post(
    "/inventory/movements/:movementId/reverse",
    async ({ actor, body, params }) => {
      return commandResponse(await input.catalog.reverseMovement(actor, params.movementId, body));
    },
    {
      record: { movementId: movementNotFound },
      body: contract(reverseInventoryMovementRequestSchema, "Reversal command is invalid"),
    },
  );
  return routes;
}
