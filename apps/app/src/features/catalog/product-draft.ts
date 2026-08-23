import type {
  CreateProductRequest,
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
  const candidate = { idempotencyKey: input.idempotencyKey, ...fields };
  const parsed =
    input.mode === "create"
      ? createProductRequestSchema.safeParse(candidate)
      : updateProductRequestSchema.safeParse(candidate);
  if (!parsed.success) return { errors: { name: "invalid" } };
  return { command: parsed.data };
}
