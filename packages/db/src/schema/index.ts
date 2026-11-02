export * from "./auth.ts";
export * from "./billing.ts";
export * from "./business.ts";
export * from "./cash.ts";
export * from "./cash-account.ts";
export * from "./catalog.ts";
export * from "./members.ts";
export * from "./purchases.ts";
export * from "./receivables.ts";
export * from "./sale-line.ts";
export * from "./sales.ts";

import * as auth from "./auth.ts";
import * as billing from "./billing.ts";
import * as business from "./business.ts";
import * as cash from "./cash.ts";
import * as catalog from "./catalog.ts";
import * as members from "./members.ts";
import * as purchases from "./purchases.ts";
import * as receivables from "./receivables.ts";
import * as saleLines from "./sale-line.ts";
import * as sales from "./sales.ts";

export const schema = {
  user: auth.user,
  session: auth.session,
  account: auth.account,
  verification: auth.verification,
  rateLimit: auth.rateLimit,
  organization: auth.organization,
  member: auth.member,
  invitation: auth.invitation,
  billingWebhookEvent: billing.billingWebhookEvent,
  billingCustomer: billing.billingCustomer,
  billingSubscription: billing.billingSubscription,
  entitlement: billing.entitlement,
  businessSettings: business.businessSettings,
  businessMemberOperation: members.businessMemberOperation,
  catalogCategory: catalog.catalogCategory,
  catalogProduct: catalog.catalogProduct,
  inventoryMovement: catalog.inventoryMovement,
  catalogOperation: catalog.catalogOperation,
  cashAccount: cash.cashAccount,
  expense: cash.expense,
  cashTransfer: cash.cashTransfer,
  cashMovement: cash.cashMovement,
  cashOperationReceipt: cash.cashOperationReceipt,
  customer: receivables.customer,
  receivable: receivables.receivable,
  receivablePayment: receivables.receivablePayment,
  receivableOperation: receivables.receivableOperation,
  supplier: purchases.supplier,
  purchase: purchases.purchase,
  purchaseLine: purchases.purchaseLine,
  supplierPayment: purchases.supplierPayment,
  purchaseOperation: purchases.purchaseOperation,
  sale: sales.sale,
  saleReview: sales.saleReview,
  saleOperation: sales.saleOperation,
  saleCorrection: sales.saleCorrection,
  saleLine: saleLines.saleLine,
};
