export const OPERATE_ROOT = "/operate";

/**
 * Product data, not a derivation of the route tree. A parent is the screen a user actually
 * arrives from, which a path cannot express: `/operate/cash/transfers/new` opens from an
 * account yet carries `fromAccountId`, so only the cash list can be rebuilt from it, and
 * `/operate/receivables/new` opens from both the receivable list and a customer.
 */
export const OPERATE_ROUTE_PARENTS = {
  "/operate/cash": "/operate",
  "/operate/cash/accounts/[accountId]": "/operate/cash",
  "/operate/cash/accounts/[accountId]/edit": "/operate/cash/accounts/[accountId]",
  "/operate/cash/accounts/new": "/operate/cash",
  "/operate/cash/adjustments/new": "/operate/cash/accounts/[accountId]",
  "/operate/cash/transfers/new": "/operate/cash",
  "/operate/catalog": "/operate",
  "/operate/catalog/[productId]": "/operate/catalog",
  "/operate/catalog/[productId]/edit": "/operate/catalog/[productId]",
  "/operate/catalog/categories": "/operate/catalog",
  "/operate/catalog/new": "/operate/catalog",
  "/operate/customers": "/operate",
  "/operate/customers/[customerId]": "/operate/customers",
  "/operate/customers/[customerId]/archive": "/operate/customers/[customerId]",
  "/operate/customers/[customerId]/edit": "/operate/customers/[customerId]",
  "/operate/customers/new": "/operate/customers",
  "/operate/expenses": "/operate",
  "/operate/expenses/[expenseId]": "/operate/expenses",
  "/operate/expenses/new": "/operate/expenses",
  "/operate/inventory": "/operate",
  "/operate/inventory/[productId]": "/operate/inventory",
  "/operate/inventory/[productId]/new": "/operate/inventory/[productId]",
  "/operate/inventory/[productId]/reverse/[movementId]": "/operate/inventory/[productId]",
  "/operate/receivables": "/operate",
  "/operate/receivables/[receivableId]": "/operate/receivables",
  "/operate/receivables/[receivableId]/payment": "/operate/receivables/[receivableId]",
  "/operate/receivables/[receivableId]/payments/[paymentId]/reverse":
    "/operate/receivables/[receivableId]",
  "/operate/receivables/[receivableId]/void": "/operate/receivables/[receivableId]",
  "/operate/receivables/new": "/operate/receivables",
  "/operate/reports": "/operate",
  "/operate/sales": "/operate",
  "/operate/sales/[saleId]": "/operate/sales",
  "/operate/sales/correct/[saleId]": "/operate/sales",
  "/operate/sales/new": "/operate/sales",
} as const satisfies Readonly<Record<string, string>>;

export type OperateRoute = typeof OPERATE_ROOT | keyof typeof OPERATE_ROUTE_PARENTS;
