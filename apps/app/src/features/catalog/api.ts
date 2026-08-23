import type {
  ArchiveCategoryRequest,
  ArchiveProductRequest,
  CategoryListQuery,
  CategoryListResponse,
  CategoryMutationResponse,
  CreateCategoryRequest,
  CreateProductRequest,
  ProductDetailResponse,
  ProductListQuery,
  ProductListResponse,
  ProductMutationResponse,
  UpdateCategoryRequest,
  UpdateProductRequest,
} from "@pisto/contracts";
import {
  archiveCategoryRequestSchema,
  archiveProductRequestSchema,
  categoryListResponseSchema,
  categoryMutationResponseSchema,
  createCategoryRequestSchema,
  createProductRequestSchema,
  productDetailResponseSchema,
  productListResponseSchema,
  productMutationResponseSchema,
  updateCategoryRequestSchema,
  updateProductRequestSchema,
} from "@pisto/contracts";
import { apiRequest } from "@/lib/api-client";

function queryString(query: Record<string, boolean | number | string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const catalogApi = {
  categories: {
    list: (query: CategoryListQuery) =>
      apiRequest<CategoryListResponse, CategoryListResponse["data"]>(
        `/v1/catalog/categories${queryString(query)}`,
        { authenticated: true },
        categoryListResponseSchema,
      ),
    create: (command: CreateCategoryRequest) =>
      apiRequest<CategoryMutationResponse, CategoryMutationResponse["data"]>(
        "/v1/catalog/categories",
        {
          authenticated: true,
          body: createCategoryRequestSchema.parse(command),
          method: "POST",
        },
        categoryMutationResponseSchema,
      ),
    update: (categoryId: string, command: UpdateCategoryRequest) =>
      apiRequest<CategoryMutationResponse, CategoryMutationResponse["data"]>(
        `/v1/catalog/categories/${encodeURIComponent(categoryId)}`,
        {
          authenticated: true,
          body: updateCategoryRequestSchema.parse(command),
          method: "PATCH",
        },
        categoryMutationResponseSchema,
      ),
    archive: (categoryId: string, command: ArchiveCategoryRequest) =>
      apiRequest<CategoryMutationResponse, CategoryMutationResponse["data"]>(
        `/v1/catalog/categories/${encodeURIComponent(categoryId)}/archive`,
        {
          authenticated: true,
          body: archiveCategoryRequestSchema.parse(command),
          method: "POST",
        },
        categoryMutationResponseSchema,
      ),
  },
  products: {
    list: (query: ProductListQuery) =>
      apiRequest<ProductListResponse, ProductListResponse["data"]>(
        `/v1/catalog/products${queryString(query)}`,
        { authenticated: true },
        productListResponseSchema,
      ),
    get: (productId: string) =>
      apiRequest<ProductDetailResponse, ProductDetailResponse["data"]>(
        `/v1/catalog/products/${encodeURIComponent(productId)}`,
        { authenticated: true },
        productDetailResponseSchema,
      ),
    create: (command: CreateProductRequest) =>
      apiRequest<ProductMutationResponse, ProductMutationResponse["data"]>(
        "/v1/catalog/products",
        {
          authenticated: true,
          body: createProductRequestSchema.parse(command),
          method: "POST",
        },
        productMutationResponseSchema,
      ),
    update: (productId: string, command: UpdateProductRequest) =>
      apiRequest<ProductMutationResponse, ProductMutationResponse["data"]>(
        `/v1/catalog/products/${encodeURIComponent(productId)}`,
        {
          authenticated: true,
          body: updateProductRequestSchema.parse(command),
          method: "PATCH",
        },
        productMutationResponseSchema,
      ),
    archive: (productId: string, command: ArchiveProductRequest) =>
      apiRequest<ProductMutationResponse, ProductMutationResponse["data"]>(
        `/v1/catalog/products/${encodeURIComponent(productId)}/archive`,
        {
          authenticated: true,
          body: archiveProductRequestSchema.parse(command),
          method: "POST",
        },
        productMutationResponseSchema,
      ),
  },
} as const;
