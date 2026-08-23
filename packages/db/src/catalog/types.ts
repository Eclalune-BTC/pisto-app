import type {
  ArchiveCategoryRequest,
  ArchiveProductRequest,
  Category,
  CategoryListQuery,
  CreateCategoryRequest,
  CreateProductRequest,
  InventoryMovement,
  InventoryMovementListQuery,
  Product,
  ProductDetail,
  ProductListQuery,
  ProductStock,
  RecordInventoryMovementRequest,
  ReverseInventoryMovementRequest,
  StockListQuery,
  UpdateCategoryRequest,
  UpdateProductRequest,
} from "@pisto/contracts";

import type { Database } from "../client.ts";
import type { ProductActor } from "../product.ts";
import type { catalogCategory, catalogProduct, inventoryMovement } from "../schema/catalog.ts";

export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DatabaseExecutor = Database | DatabaseTransaction;
export type CategoryRecord = typeof catalogCategory.$inferSelect;
export type ProductRecord = typeof catalogProduct.$inferSelect;
export type MovementRecord = typeof inventoryMovement.$inferSelect;
export type CursorKind = "category" | "product" | "movement" | "stock";
export type OperationAction =
  | "category.created"
  | "category.updated"
  | "category.archived"
  | "product.created"
  | "product.updated"
  | "product.archived"
  | "inventory.receive"
  | "inventory.adjust_in"
  | "inventory.adjust_out"
  | "inventory.reverse";

export interface AuthorizedBusiness {
  businessId: string;
  currency: string;
  currencyMinorUnitDigits: number;
  timeZone: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CatalogRepository {
  listCategories(actor: ProductActor, query: CategoryListQuery): Promise<Page<Category>>;
  createCategory(
    actor: ProductActor,
    command: CreateCategoryRequest,
  ): Promise<{ category: Category; replayed: boolean }>;
  updateCategory(
    actor: ProductActor,
    categoryId: string,
    command: UpdateCategoryRequest,
  ): Promise<{ category: Category; replayed: boolean }>;
  archiveCategory(
    actor: ProductActor,
    categoryId: string,
    command: ArchiveCategoryRequest,
  ): Promise<{ category: Category; replayed: boolean }>;
  listProducts(actor: ProductActor, query: ProductListQuery): Promise<Page<ProductDetail>>;
  getProduct(actor: ProductActor, productId: string): Promise<ProductDetail>;
  createProduct(
    actor: ProductActor,
    command: CreateProductRequest,
  ): Promise<{ product: Product; replayed: boolean }>;
  updateProduct(
    actor: ProductActor,
    productId: string,
    command: UpdateProductRequest,
  ): Promise<{ product: Product; replayed: boolean }>;
  archiveProduct(
    actor: ProductActor,
    productId: string,
    command: ArchiveProductRequest,
  ): Promise<{ product: Product; replayed: boolean }>;
  listStock(
    actor: ProductActor,
    query: StockListQuery,
  ): Promise<Page<{ product: Product; stock: ProductStock }>>;
  listMovements(
    actor: ProductActor,
    productId: string,
    query: InventoryMovementListQuery,
  ): Promise<Page<InventoryMovement>>;
  recordMovement(
    actor: ProductActor,
    productId: string,
    command: RecordInventoryMovementRequest,
  ): Promise<{ movement: InventoryMovement; stock: ProductStock; replayed: boolean }>;
  reverseMovement(
    actor: ProductActor,
    movementId: string,
    command: ReverseInventoryMovementRequest,
  ): Promise<{ movement: InventoryMovement; stock: ProductStock; replayed: boolean }>;
}

export type CatalogQueries = Pick<
  CatalogRepository,
  "getProduct" | "listCategories" | "listMovements" | "listProducts" | "listStock"
>;
export type CategoryCommands = Pick<
  CatalogRepository,
  "archiveCategory" | "createCategory" | "updateCategory"
>;
export type ProductCommands = Pick<
  CatalogRepository,
  "archiveProduct" | "createProduct" | "updateProduct"
>;
export type InventoryCommands = Pick<CatalogRepository, "recordMovement" | "reverseMovement">;
