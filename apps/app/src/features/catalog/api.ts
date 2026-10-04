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
import { apiRequest, parseRequestPayload, pathWithQuery } from "@/lib/api-client";

export const catalogApi = {
  categories: {
    list: (query: CategoryListQuery, signal?: AbortSignal) =>
      apiRequest<CategoryListResponse, CategoryListResponse["data"]>(
        pathWithQuery("/v1/catalog/categories", query),
        { authenticated: true, signal },
        categoryListResponseSchema,
      ),
    create: (command: CreateCategoryRequest) =>
      apiRequest<CategoryMutationResponse, CategoryMutationResponse["data"]>(
        "/v1/catalog/categories",
        {
          authenticated: true,
          body: parseRequestPayload(createCategoryRequestSchema, command),
          method: "POST",
        },
        categoryMutationResponseSchema,
      ),
    update: (categoryId: string, command: UpdateCategoryRequest) =>
      apiRequest<CategoryMutationResponse, CategoryMutationResponse["data"]>(
        `/v1/catalog/categories/${encodeURIComponent(categoryId)}`,
        {
          authenticated: true,
          body: parseRequestPayload(updateCategoryRequestSchema, command),
          method: "PATCH",
        },
        categoryMutationResponseSchema,
      ),
    archive: (categoryId: string, command: ArchiveCategoryRequest) =>
      apiRequest<CategoryMutationResponse, CategoryMutationResponse["data"]>(
        `/v1/catalog/categories/${encodeURIComponent(categoryId)}/archive`,
        {
          authenticated: true,
          body: parseRequestPayload(archiveCategoryRequestSchema, command),
          method: "POST",
        },
        categoryMutationResponseSchema,
      ),
  },
  products: {
    list: (query: ProductListQuery, signal?: AbortSignal) =>
      apiRequest<ProductListResponse, ProductListResponse["data"]>(
        pathWithQuery("/v1/catalog/products", query),
        { authenticated: true, signal },
        productListResponseSchema,
      ),
    get: (productId: string, signal?: AbortSignal) =>
      apiRequest<ProductDetailResponse, ProductDetailResponse["data"]>(
        `/v1/catalog/products/${encodeURIComponent(productId)}`,
        { authenticated: true, signal },
        productDetailResponseSchema,
      ),
    create: (command: CreateProductRequest) =>
      apiRequest<ProductMutationResponse, ProductMutationResponse["data"]>(
        "/v1/catalog/products",
        {
          authenticated: true,
          body: parseRequestPayload(createProductRequestSchema, command),
          method: "POST",
        },
        productMutationResponseSchema,
      ),
    update: (productId: string, command: UpdateProductRequest) =>
      apiRequest<ProductMutationResponse, ProductMutationResponse["data"]>(
        `/v1/catalog/products/${encodeURIComponent(productId)}`,
        {
          authenticated: true,
          body: parseRequestPayload(updateProductRequestSchema, command),
          method: "PATCH",
        },
        productMutationResponseSchema,
      ),
    archive: (productId: string, command: ArchiveProductRequest) =>
      apiRequest<ProductMutationResponse, ProductMutationResponse["data"]>(
        `/v1/catalog/products/${encodeURIComponent(productId)}/archive`,
        {
          authenticated: true,
          body: parseRequestPayload(archiveProductRequestSchema, command),
          method: "POST",
        },
        productMutationResponseSchema,
      ),
  },
} as const;
