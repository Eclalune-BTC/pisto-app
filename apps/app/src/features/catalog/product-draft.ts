import type {
  CreateProductRequest,
  Product,
  ProductUnitKind,
  UpdateProductRequest,
} from "@pisto/contracts";
import { createProductRequestSchema, updateProductRequestSchema } from "@pisto/contracts";
import { parseAmountToMinorUnits, toDecimalString } from "@/lib/money";
import { formatQuantityMinorUnits, parseQuantityToMinorUnits } from "../inventory/quantity";

export type QuantityPrecision = 0 | 1 | 2 | 3;

export const quantityPrecisions: readonly QuantityPrecision[] = [0, 1, 2, 3];

export interface ProductDraftFields {
  categoryId: string | null;
  lowStockThreshold: string;
  name: string;
  quantityPrecision: QuantityPrecision;
  sellingPrice: string;
  sku: string;
  tracked: boolean;
  unitKind: ProductUnitKind;
}

export type ProductDraftField = "lowStockThreshold" | "name" | "sellingPrice" | "sku";

export type ProductDraftErrors = Partial<Record<ProductDraftField | "form", string>>;

export type ProductCommand = CreateProductRequest | UpdateProductRequest;

export const emptyProductDraft: ProductDraftFields = {
  categoryId: null,
  lowStockThreshold: "",
  name: "",
  quantityPrecision: 0,
  sellingPrice: "",
  sku: "",
  tracked: false,
  unitKind: "unit",
};

export function buildProductCommand(input: {
  currencyMinorUnitDigits: number;
  draft: ProductDraftFields;
  idempotencyKey: string;
  mode: "create" | "edit";
  original?: Product;
}): { errors: ProductDraftErrors } | { command: ProductCommand } {
  const errors: ProductDraftErrors = {};
  const name = input.draft.name.trim();
  const sku = input.draft.sku.trim();
  if (!name) errors.name = "missing";
  else if (name.length > 120) errors.name = "too-long";
  if (sku.length > 64) errors.sku = "too-long";
  const price = input.draft.sellingPrice.trim()
    ? parseAmountToMinorUnits(input.draft.sellingPrice, input.currencyMinorUnitDigits, {
        allowZero: true,
      })
    : null;
  if (price && "error" in price) errors.sellingPrice = "invalid";
  const threshold =
    input.draft.tracked && input.draft.lowStockThreshold.trim()
      ? parseQuantityToMinorUnits(input.draft.lowStockThreshold, input.draft.quantityPrecision, {
          allowZero: true,
        })
      : null;
  if (threshold && "error" in threshold) errors.lowStockThreshold = threshold.error;
  if (Object.keys(errors).length > 0 || (price && "error" in price)) return { errors };
  const thresholdMinorUnits = threshold && "value" in threshold ? threshold.value : null;

  const fields = {
    categoryId: input.draft.categoryId,
    lowStockThresholdMinorUnits: input.draft.tracked ? thresholdMinorUnits : null,
    name,
    quantityPrecision: input.draft.quantityPrecision,
    sellingPriceMinorUnits: price?.value ?? null,
    sku: sku || null,
    tracked: input.draft.tracked,
    unitKind: input.draft.unitKind,
  };
  const candidate =
    input.mode === "create"
      ? { idempotencyKey: input.idempotencyKey, ...fields }
      : buildChangedProductFields(input.idempotencyKey, fields, input.original);
  if (input.mode === "edit" && Object.keys(candidate).length === 1) {
    return { errors: { form: "no-changes" } };
  }
  const parsed =
    input.mode === "create"
      ? createProductRequestSchema.safeParse(candidate)
      : updateProductRequestSchema.safeParse(candidate);
  // Every field was validated above, so only a malformed key or category can fail here.
  if (!parsed.success) throw new Error("The product command does not match its contract");
  return { command: parsed.data };
}

function buildChangedProductFields(
  idempotencyKey: string,
  fields: Omit<CreateProductRequest, "idempotencyKey">,
  original: Product | undefined,
): Record<string, unknown> {
  if (!original) return { idempotencyKey, ...fields };
  return {
    idempotencyKey,
    ...(fields.categoryId !== original.categoryId ? { categoryId: fields.categoryId } : {}),
    ...(fields.lowStockThresholdMinorUnits !== original.lowStockThresholdMinorUnits
      ? { lowStockThresholdMinorUnits: fields.lowStockThresholdMinorUnits }
      : {}),
    ...(fields.name !== original.name ? { name: fields.name } : {}),
    ...(fields.quantityPrecision !== original.quantityPrecision
      ? { quantityPrecision: fields.quantityPrecision }
      : {}),
    ...(fields.sellingPriceMinorUnits !== original.sellingPriceMinorUnits
      ? { sellingPriceMinorUnits: fields.sellingPriceMinorUnits }
      : {}),
    ...(fields.sku !== original.sku ? { sku: fields.sku } : {}),
    ...(fields.tracked !== original.tracked ? { tracked: fields.tracked } : {}),
    ...(fields.unitKind !== original.unitKind ? { unitKind: fields.unitKind } : {}),
  };
}

export function productToDraft(product: Product): ProductDraftFields {
  const precision = quantityPrecisions.find((value) => value === product.quantityPrecision);
  if (precision === undefined) throw new Error("The product quantity precision is unsupported");
  return {
    categoryId: product.categoryId,
    lowStockThreshold:
      product.lowStockThresholdMinorUnits === null
        ? ""
        : formatQuantityMinorUnits(product.lowStockThresholdMinorUnits, precision),
    name: product.name,
    quantityPrecision: precision,
    sellingPrice:
      product.sellingPriceMinorUnits === null ||
      product.sellingPriceCurrencyMinorUnitDigits === null
        ? ""
        : toDecimalString(
            product.sellingPriceMinorUnits,
            product.sellingPriceCurrencyMinorUnitDigits,
          ),
    sku: product.sku ?? "",
    tracked: product.tracked,
    unitKind: product.unitKind,
  };
}

/**
 * The draft with the unit, decimals and tracking the product already has. Movements freeze those
 * fields; an unchanged draft is returned as is.
 */
export function withFrozenHistoryFields(
  draft: ProductDraftFields,
  product: Product,
): ProductDraftFields {
  const frozen = productToDraft(product);
  return draft.quantityPrecision === frozen.quantityPrecision &&
    draft.tracked === frozen.tracked &&
    draft.unitKind === frozen.unitKind
    ? draft
    : {
        ...draft,
        quantityPrecision: frozen.quantityPrecision,
        tracked: frozen.tracked,
        unitKind: frozen.unitKind,
      };
}

/** The values a reviewed command leaves on the product: changed fields over the original. */
export function resolvedProductFields(command: ProductCommand, original: Product | undefined) {
  if (!original) {
    const create = command as CreateProductRequest;
    return {
      categoryId: create.categoryId ?? null,
      lowStockThresholdMinorUnits: create.lowStockThresholdMinorUnits ?? null,
      name: create.name,
      quantityPrecision: create.quantityPrecision,
      sellingPriceMinorUnits: create.sellingPriceMinorUnits ?? null,
      sku: create.sku ?? null,
      tracked: create.tracked,
      unitKind: create.unitKind,
    };
  }
  const update = command as UpdateProductRequest;
  return {
    categoryId: update.categoryId === undefined ? original.categoryId : update.categoryId,
    lowStockThresholdMinorUnits:
      update.lowStockThresholdMinorUnits === undefined
        ? original.lowStockThresholdMinorUnits
        : update.lowStockThresholdMinorUnits,
    name: update.name ?? original.name,
    quantityPrecision: update.quantityPrecision ?? original.quantityPrecision,
    sellingPriceMinorUnits:
      update.sellingPriceMinorUnits === undefined
        ? original.sellingPriceMinorUnits
        : update.sellingPriceMinorUnits,
    sku: update.sku === undefined ? original.sku : update.sku,
    tracked: update.tracked ?? original.tracked,
    unitKind: update.unitKind ?? original.unitKind,
  };
}

export type ResolvedProductFields = ReturnType<typeof resolvedProductFields>;
