import type {
  CreateSaleRequest,
  PreviousMonthSummary,
  ReplaceSaleRequest,
  Sale,
  SaleCorrection,
  SaleList,
  SaleListQuery,
  SaleReview,
  VoidSaleRequest,
} from "@pisto/contracts";

import type { ProductActor } from "../business-access.ts";

export interface SaleCorrectionResult {
  correction: SaleCorrection;
  originalSale: Sale;
  replacementSale: Sale | null;
  replayed: boolean;
}

export interface SalesRepository {
  getSaleReview(actor: ProductActor): Promise<SaleReview | null>;
  prepareSaleReview(actor: ProductActor, command: CreateSaleRequest): Promise<SaleReview>;
  confirmSaleReview(
    actor: ProductActor,
    reviewId: string,
  ): Promise<{ sale: Sale; replayed: boolean }>;
  dismissSaleReview(
    actor: ProductActor,
    reviewId: string,
    acknowledgedSaleId: string | null,
  ): Promise<{ saleId: string | null }>;
  createSale(
    actor: ProductActor,
    command: CreateSaleRequest,
  ): Promise<{ sale: Sale; replayed: boolean }>;
  voidSale(
    actor: ProductActor,
    saleId: string,
    command: VoidSaleRequest,
  ): Promise<SaleCorrectionResult>;
  replaceSale(
    actor: ProductActor,
    saleId: string,
    command: ReplaceSaleRequest,
  ): Promise<SaleCorrectionResult>;
  getSale(actor: ProductActor, saleId: string): Promise<Sale>;
  listSales(actor: ProductActor, query: SaleListQuery): Promise<SaleList>;
  getPreviousMonthSummary(actor: ProductActor): Promise<PreviousMonthSummary>;
}
