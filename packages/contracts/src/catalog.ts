import { z } from "zod";

import {
  aggregateIntegerSchema,
  boundedListLimitSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  localDateSchema,
  localTimeSchema,
  minorUnitsSchema,
  opaqueCursorSchema,
  positiveMinorUnitsSchema,
  signedMinorUnitsSchema,
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
} from "./primitives";

export const catalogRecordStatusSchema = z.enum(["active", "archived"]);
export const productUnitKindSchema = z.enum([
  "unit",
  "kilogram",
  "gram",
  "liter",
  "milliliter",
  "meter",
]);
export const quantityPrecisionSchema = z.number().int().min(0).max(3);

export const quantityMinorUnitsSchema = minorUnitsSchema;
export const positiveQuantityMinorUnitsSchema = positiveMinorUnitsSchema;
export const signedQuantityMinorUnitsSchema = signedMinorUnitsSchema;
export const aggregateQuantityMinorUnitsSchema = aggregateIntegerSchema;

export const catalogCursorSchema = opaqueCursorSchema;
export const catalogListLimitSchema = boundedListLimitSchema;

export const categorySchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(80),
  status: catalogRecordStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const categoryListQuerySchema = z
  .object({
    cursor: catalogCursorSchema.optional(),
    limit: catalogListLimitSchema,
    search: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["active", "archived", "all"]).default("active"),
  })
  .strict();

export const createCategoryRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    name: z.string().trim().min(1).max(80),
  })
  .strict();

export const updateCategoryRequestSchema = createCategoryRequestSchema;

export const archiveCategoryRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
  })
  .strict();

export const categoryMutationResponseSchema = z.object({
  data: z.object({
    category: categorySchema,
    replayed: z.boolean(),
  }),
});

export const categoryListResponseSchema = z.object({
  data: z.object({
    items: z.array(categorySchema),
    nextCursor: catalogCursorSchema.nullable(),
  }),
});

export const productSchema = z
  .object({
    id: uuidSchema,
    categoryId: uuidSchema.nullable(),
    name: z.string().trim().min(1).max(120),
    sku: z.string().trim().min(1).max(64).nullable(),
    sellingPriceMinorUnits: quantityMinorUnitsSchema.nullable(),
    sellingPriceCurrency: currencyCodeSchema.nullable(),
    sellingPriceCurrencyMinorUnitDigits: currencyMinorUnitDigitsSchema.nullable(),
    unitKind: productUnitKindSchema,
    quantityPrecision: quantityPrecisionSchema,
    tracked: z.boolean(),
    lowStockThresholdMinorUnits: quantityMinorUnitsSchema.nullable(),
    status: catalogRecordStatusSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((value, context) => {
    const priceParts = [
      value.sellingPriceMinorUnits,
      value.sellingPriceCurrency,
      value.sellingPriceCurrencyMinorUnitDigits,
    ];
    const hasPrice = priceParts.every((part) => part !== null);
    const hasNoPrice = priceParts.every((part) => part === null);
    if (!hasPrice && !hasNoPrice) {
      context.addIssue({
        code: "custom",
        message: "Selling price and its currency snapshot must be present together",
        path: ["sellingPriceMinorUnits"],
      });
    }
    if (!value.tracked && value.lowStockThresholdMinorUnits !== null) {
      context.addIssue({
        code: "custom",
        message: "An untracked product cannot have a low-stock threshold",
        path: ["lowStockThresholdMinorUnits"],
      });
    }
  });

const productWriteFields = {
  categoryId: uuidSchema.nullable().optional(),
  lowStockThresholdMinorUnits: quantityMinorUnitsSchema.nullable().optional(),
  name: z.string().trim().min(1).max(120),
  quantityPrecision: quantityPrecisionSchema,
  sellingPriceMinorUnits: quantityMinorUnitsSchema.nullable().optional(),
  sku: z.string().trim().min(1).max(64).nullable().optional(),
  tracked: z.boolean(),
  unitKind: productUnitKindSchema,
} as const;

export const createProductRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    ...productWriteFields,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.tracked && value.lowStockThresholdMinorUnits != null) {
      context.addIssue({
        code: "custom",
        message: "An untracked product cannot have a low-stock threshold",
        path: ["lowStockThresholdMinorUnits"],
      });
    }
  });

export const updateProductRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    categoryId: productWriteFields.categoryId,
    lowStockThresholdMinorUnits: productWriteFields.lowStockThresholdMinorUnits,
    name: productWriteFields.name.optional(),
    quantityPrecision: productWriteFields.quantityPrecision.optional(),
    sellingPriceMinorUnits: productWriteFields.sellingPriceMinorUnits,
    sku: productWriteFields.sku,
    tracked: productWriteFields.tracked.optional(),
    unitKind: productWriteFields.unitKind.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const changedFields = Object.keys(value).filter((key) => key !== "idempotencyKey");
    if (changedFields.length === 0) {
      context.addIssue({ code: "custom", message: "At least one product field must change" });
    }
    if (value.tracked === false && value.lowStockThresholdMinorUnits != null) {
      context.addIssue({
        code: "custom",
        message: "An untracked product cannot have a low-stock threshold",
        path: ["lowStockThresholdMinorUnits"],
      });
    }
  });

export const archiveProductRequestSchema = archiveCategoryRequestSchema;

export const productListQuerySchema = z
  .object({
    categoryId: uuidSchema.optional(),
    cursor: catalogCursorSchema.optional(),
    limit: catalogListLimitSchema,
    search: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["active", "archived", "all"]).default("active"),
  })
  .strict();

export const productStockSchema = z.object({
  productId: uuidSchema,
  quantityPrecision: quantityPrecisionSchema,
  onHandMinorUnits: aggregateQuantityMinorUnitsSchema,
  lowStockThresholdMinorUnits: quantityMinorUnitsSchema.nullable(),
  lowStock: z.boolean(),
});

export const productDetailSchema = z.object({
  product: productSchema,
  stock: productStockSchema.nullable(),
});

export const productMutationResponseSchema = z.object({
  data: z.object({
    product: productSchema,
    replayed: z.boolean(),
  }),
});

export const productDetailResponseSchema = z.object({
  data: productDetailSchema,
});

export const productListItemSchema = productDetailSchema;

export const productListResponseSchema = z.object({
  data: z.object({
    items: z.array(productListItemSchema),
    nextCursor: catalogCursorSchema.nullable(),
  }),
});

export const inventoryMovementActionSchema = z.enum([
  "receive",
  "adjust_in",
  "adjust_out",
  "reverse",
]);

export const inventoryMovementSchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
  action: inventoryMovementActionSchema,
  quantityMinorUnits: positiveQuantityMinorUnitsSchema,
  deltaMinorUnits: signedQuantityMinorUnitsSchema.refine(
    (value) => value !== "0",
    "Movement delta cannot be zero",
  ),
  quantityPrecision: quantityPrecisionSchema,
  reason: z.string().trim().min(1).max(240),
  occurredAt: timestampSchema,
  occurredLocalDate: localDateSchema,
  occurredLocalTime: localTimeSchema,
  timeZone: timeZoneSchema,
  createdByUserId: z.string().min(1),
  reversesMovementId: uuidSchema.nullable(),
  reversedByMovementId: uuidSchema.nullable(),
  createdAt: timestampSchema,
});

export const recordInventoryMovementRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    action: z.enum(["receive", "adjust_in", "adjust_out"]),
    quantityMinorUnits: positiveQuantityMinorUnitsSchema,
    reason: z.string().trim().min(1).max(240),
    occurredLocalDate: localDateSchema,
    occurredLocalTime: localTimeSchema,
  })
  .strict();

export const reverseInventoryMovementRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    reason: z.string().trim().min(1).max(240),
    occurredLocalDate: localDateSchema,
    occurredLocalTime: localTimeSchema,
  })
  .strict();

export const inventoryMovementListQuerySchema = z
  .object({
    cursor: catalogCursorSchema.optional(),
    limit: catalogListLimitSchema,
  })
  .strict();

export const stockListQuerySchema = z
  .object({
    cursor: catalogCursorSchema.optional(),
    limit: catalogListLimitSchema,
    lowStockOnly: z
      .union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")])
      .default(false),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const inventoryMutationResponseSchema = z.object({
  data: z.object({
    movement: inventoryMovementSchema,
    stock: productStockSchema,
    replayed: z.boolean(),
  }),
});

export const inventoryMovementListResponseSchema = z.object({
  data: z.object({
    items: z.array(inventoryMovementSchema),
    nextCursor: catalogCursorSchema.nullable(),
  }),
});

export const stockListItemSchema = z.object({
  product: productSchema,
  stock: productStockSchema,
});

export const stockListResponseSchema = z.object({
  data: z.object({
    items: z.array(stockListItemSchema),
    nextCursor: catalogCursorSchema.nullable(),
  }),
});

export type CatalogRecordStatus = z.infer<typeof catalogRecordStatusSchema>;
export type ProductUnitKind = z.infer<typeof productUnitKindSchema>;
export type Category = z.infer<typeof categorySchema>;
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;
export type ArchiveCategoryRequest = z.infer<typeof archiveCategoryRequestSchema>;
export type CategoryMutationResponse = z.infer<typeof categoryMutationResponseSchema>;
export type CategoryListResponse = z.infer<typeof categoryListResponseSchema>;
export type Product = z.infer<typeof productSchema>;
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;
export type ArchiveProductRequest = z.infer<typeof archiveProductRequestSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductStock = z.infer<typeof productStockSchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;
export type ProductMutationResponse = z.infer<typeof productMutationResponseSchema>;
export type ProductDetailResponse = z.infer<typeof productDetailResponseSchema>;
export type ProductListResponse = z.infer<typeof productListResponseSchema>;
export type InventoryMovementAction = z.infer<typeof inventoryMovementActionSchema>;
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;
export type RecordInventoryMovementRequest = z.infer<typeof recordInventoryMovementRequestSchema>;
export type ReverseInventoryMovementRequest = z.infer<typeof reverseInventoryMovementRequestSchema>;
export type InventoryMovementListQuery = z.infer<typeof inventoryMovementListQuerySchema>;
export type StockListQuery = z.infer<typeof stockListQuerySchema>;
export type InventoryMutationResponse = z.infer<typeof inventoryMutationResponseSchema>;
export type InventoryMovementListResponse = z.infer<typeof inventoryMovementListResponseSchema>;
export type StockListResponse = z.infer<typeof stockListResponseSchema>;
