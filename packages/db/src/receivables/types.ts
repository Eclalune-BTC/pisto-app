import type {
  ApplyReceivablePaymentRequest,
  ArchiveCustomerRequest,
  CreateCustomerRequest,
  Customer,
  CustomerDetail,
  ListCustomersQuery,
  ListReceivablesQuery,
  PostReceivableRequest,
  Receivable,
  ReceivablePayment,
  ReceivablesSummary,
  ReverseReceivablePaymentRequest,
  UpdateCustomerRequest,
  VoidReceivableRequest,
} from "@pisto/contracts";
import type { ProductActor } from "../business-access.ts";
import type { customer, receivable, receivablePayment } from "../schema/receivables.ts";

export type CustomerRecord = typeof customer.$inferSelect;
export type ReceivableRecord = typeof receivable.$inferSelect;
export type PaymentRecord = typeof receivablePayment.$inferSelect;

export interface ReceivablesRepository {
  createCustomer(
    actor: ProductActor,
    command: CreateCustomerRequest,
  ): Promise<{ customer: Customer; replayed: boolean }>;
  updateCustomer(
    actor: ProductActor,
    customerId: string,
    command: UpdateCustomerRequest,
  ): Promise<{ customer: Customer; replayed: boolean }>;
  archiveCustomer(
    actor: ProductActor,
    customerId: string,
    command: ArchiveCustomerRequest,
  ): Promise<{ customer: Customer; replayed: boolean }>;
  listCustomers(
    actor: ProductActor,
    query: ListCustomersQuery,
  ): Promise<{ items: Customer[]; nextCursor: string | null }>;
  getCustomer(actor: ProductActor, customerId: string): Promise<CustomerDetail>;
  postReceivable(
    actor: ProductActor,
    command: PostReceivableRequest,
  ): Promise<{ receivable: Receivable; replayed: boolean }>;
  voidReceivable(
    actor: ProductActor,
    receivableId: string,
    command: VoidReceivableRequest,
  ): Promise<{ receivable: Receivable; replayed: boolean }>;
  applyPayment(
    actor: ProductActor,
    receivableId: string,
    command: ApplyReceivablePaymentRequest,
  ): Promise<{ payment: ReceivablePayment; receivable: Receivable; replayed: boolean }>;
  reversePayment(
    actor: ProductActor,
    paymentId: string,
    command: ReverseReceivablePaymentRequest,
  ): Promise<{ payment: ReceivablePayment; receivable: Receivable; replayed: boolean }>;
  listReceivables(
    actor: ProductActor,
    query: ListReceivablesQuery,
  ): Promise<{ items: Receivable[]; nextCursor: string | null }>;
  getReceivable(
    actor: ProductActor,
    receivableId: string,
  ): Promise<{ receivable: Receivable; payments: ReceivablePayment[] }>;
  getSummary(actor: ProductActor): Promise<ReceivablesSummary>;
}
