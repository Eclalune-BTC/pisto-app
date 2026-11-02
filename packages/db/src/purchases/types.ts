import type {
  ArchiveSupplierRequest,
  CreatePurchaseRequest,
  CreateSupplierPaymentRequest,
  CreateSupplierRequest,
  ListPurchasesQuery,
  ListSuppliersQuery,
  PayablesSummaryResponse,
  Purchase,
  ReceivePurchaseRequest,
  Supplier,
  SupplierDetailResponse,
  SupplierListResponse,
  SupplierPayment,
  UpdateSupplierRequest,
  VoidPurchaseRequest,
} from "@pisto/contracts";

import type { ProductActor } from "../business-access.ts";
import type { purchase, purchaseLine, supplier, supplierPayment } from "../schema/purchases.ts";

export type SupplierRecord = typeof supplier.$inferSelect;
export type PurchaseRecord = typeof purchase.$inferSelect;
export type PurchaseLineRecord = typeof purchaseLine.$inferSelect;
export type SupplierPaymentRecord = typeof supplierPayment.$inferSelect;

export type SupplierListItem = SupplierListResponse["data"]["items"][number];

export interface PurchasesRepository {
  createSupplier(
    actor: ProductActor,
    command: CreateSupplierRequest,
  ): Promise<{ supplier: Supplier; replayed: boolean }>;
  updateSupplier(
    actor: ProductActor,
    supplierId: string,
    command: UpdateSupplierRequest,
  ): Promise<{ supplier: Supplier; replayed: boolean }>;
  archiveSupplier(
    actor: ProductActor,
    supplierId: string,
    command: ArchiveSupplierRequest,
  ): Promise<{ supplier: Supplier; replayed: boolean }>;
  listSuppliers(
    actor: ProductActor,
    query: ListSuppliersQuery,
  ): Promise<SupplierListResponse["data"]>;
  getSupplier(actor: ProductActor, supplierId: string): Promise<SupplierDetailResponse["data"]>;
  createPurchase(
    actor: ProductActor,
    command: CreatePurchaseRequest,
  ): Promise<{ purchase: Purchase; replayed: boolean }>;
  receivePurchase(
    actor: ProductActor,
    purchaseId: string,
    command: ReceivePurchaseRequest,
  ): Promise<{ purchase: Purchase; replayed: boolean }>;
  voidPurchase(
    actor: ProductActor,
    purchaseId: string,
    command: VoidPurchaseRequest,
  ): Promise<{ purchase: Purchase; replayed: boolean }>;
  createSupplierPayment(
    actor: ProductActor,
    purchaseId: string,
    command: CreateSupplierPaymentRequest,
  ): Promise<{ payment: SupplierPayment; purchase: Purchase; replayed: boolean }>;
  listPurchases(
    actor: ProductActor,
    query: ListPurchasesQuery,
  ): Promise<{ items: Purchase[]; nextCursor: string | null; queriedAt: string }>;
  getPurchase(
    actor: ProductActor,
    purchaseId: string,
  ): Promise<{ purchase: Purchase; payments: SupplierPayment[] }>;
  getPayablesSummary(actor: ProductActor): Promise<PayablesSummaryResponse["data"]>;
}
