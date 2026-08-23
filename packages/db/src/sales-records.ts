import type {
  CreateSaleRequest,
  ReplaceSaleRequest,
  Sale,
  SaleCorrection,
  VoidSaleRequest,
} from "@pisto/contracts";

import { fingerprintValue, maximumMinorUnits } from "./operation-log.ts";
import { ProductError } from "./product-core.ts";
import type { sale, saleCorrection } from "./schema/sales.ts";

export type SaleRecord = typeof sale.$inferSelect;
export type SaleCorrectionRecord = typeof saleCorrection.$inferSelect;
export type SaleCorrectionInput =
  | { kind: "void"; command: VoidSaleRequest }
  | { kind: "replacement"; command: ReplaceSaleRequest };

export function parseSaleMinorUnits(value: string): bigint {
  if (!/^[1-9]\d{0,18}$/.test(value)) {
    throw new ProductError("VALIDATION_ERROR", "Sale total must be a positive integer");
  }
  const parsed = BigInt(value);
  if (parsed > maximumMinorUnits) {
    throw new ProductError("VALIDATION_ERROR", "Sale total is too large");
  }
  return parsed;
}

export function saleFingerprint(command: CreateSaleRequest): Promise<string> {
  return fingerprintValue({
    version: 1,
    action: "sale.posted",
    grossMinorUnits: command.grossMinorUnits,
    occurredLocalDate: command.occurredLocalDate,
    occurredLocalTime: command.occurredLocalTime,
    description: command.description ?? null,
  });
}

export function correctionFingerprint(saleId: string, input: SaleCorrectionInput): Promise<string> {
  return fingerprintValue({
    version: 1,
    action: input.kind === "void" ? "sale.voided" : "sale.replaced",
    saleId,
    reason: input.command.reason,
    replacement: input.kind === "replacement" ? input.command.replacement : null,
  });
}

export function toCorrection(record: SaleCorrectionRecord): SaleCorrection {
  return {
    id: record.id,
    kind: record.kind === "replacement" ? "replacement" : "void",
    reason: record.reason,
    originalSaleId: record.originalSaleId,
    replacementSaleId: record.replacementSaleId,
    correctedAt: record.createdAt.toISOString(),
  };
}

export function toSale(record: SaleRecord, correction: SaleCorrection | null = null): Sale {
  return {
    id: record.id,
    status: record.status === "voided" ? "voided" : "posted",
    entryMode: "total_only",
    grossMinorUnits: record.grossMinorUnits.toString(),
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    occurredAt: record.occurredAt.toISOString(),
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    description: record.description,
    correction,
    createdAt: record.createdAt.toISOString(),
  };
}
