import type {
  CreateProductRequest,
  Product,
  UpdateProductRequest,
} from "../../../../../packages/contracts/src/catalog";
import {
  createProductRequestSchema,
  updateProductRequestSchema,
} from "../../../../../packages/contracts/src/catalog";
import { parseQuantityToMinorUnits } from "../inventory/quantity";
import type { ProductDraftErrors, ProductDraftFields } from "./product-editor";

const maximumMinorUnits = 9_223_372_036_854_775_807n;

function parsePrice(input: string, fractionDigits: number): string | null | "invalid" {
  const normalized = input.trim().replace(",", ".");
  if (!normalized) return null;
  const pattern =
    fractionDigits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{0,${fractionDigits}})?$`);
  if (!pattern.test(normalized)) return "invalid";
  const [whole = "0", fraction = ""] = normalized.split(".");
  const canonical = `${whole}${fraction.padEnd(fractionDigits, "0")}`.replace(/^0+(?=\d)/, "");
  const parsed = BigInt(canonical || "0");
  return parsed > maximumMinorUnits ? "invalid" : parsed.toString();
}

export function buildProductCommand(input: {
  currencyMinorUnitDigits: number;
  draft: ProductDraftFields;
  idempotencyKey: string;
  mode: "create" | "edit";
  original?: Product;
}): { errors: ProductDraftErrors } | { command: CreateProductRequest | UpdateProductRequest } {
  const errors: ProductDraftErrors = {};
  const name = input.draft.name.trim();
  const sku = input.draft.sku.trim();
  if (!name || name.length > 120) errors.name = "invalid";
  if (sku.length > 64) errors.sku = "invalid";
  const sellingPriceMinorUnits = parsePrice(
    input.draft.sellingPrice,
    input.currencyMinorUnitDigits,
  );
  if (sellingPriceMinorUnits === "invalid") errors.sellingPrice = "invalid";
  const threshold = input.draft.lowStockThreshold.trim()
    ? parseQuantityToMinorUnits(input.draft.lowStockThreshold, input.draft.quantityPrecision, {
        allowZero: true,
      })
    : null;
  if (threshold && "error" in threshold) errors.lowStockThreshold = threshold.error;
  if (Object.keys(errors).length > 0 || sellingPriceMinorUnits === "invalid") return { errors };
  const thresholdMinorUnits = threshold && "value" in threshold ? threshold.value : null;

  const fields = {
    categoryId: input.draft.categoryId,
    lowStockThresholdMinorUnits: input.draft.tracked ? thresholdMinorUnits : null,
    name,
    quantityPrecision: input.draft.quantityPrecision,
    sellingPriceMinorUnits,
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
  if (!parsed.success) return { errors: { name: "invalid" } };
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

export function formatMinorUnitsForInput(value: string, fractionDigits: number): string {
  if (fractionDigits === 0) return value;
  const padded = value.padStart(fractionDigits + 1, "0");
  return `${padded.slice(0, -fractionDigits)}.${padded.slice(-fractionDigits)}`;
}

export function productToDraft(product: Product): ProductDraftFields {
  return {
    categoryId: product.categoryId,
    lowStockThreshold:
      product.lowStockThresholdMinorUnits === null
        ? ""
        : formatMinorUnitsForInput(product.lowStockThresholdMinorUnits, product.quantityPrecision),
    name: product.name,
    quantityPrecision: product.quantityPrecision as 0 | 1 | 2 | 3,
    sellingPrice:
      product.sellingPriceMinorUnits === null ||
      product.sellingPriceCurrencyMinorUnitDigits === null
        ? ""
        : formatMinorUnitsForInput(
            product.sellingPriceMinorUnits,
            product.sellingPriceCurrencyMinorUnitDigits,
          ),
    sku: product.sku ?? "",
    tracked: product.tracked,
    unitKind: product.unitKind,
  };
}
