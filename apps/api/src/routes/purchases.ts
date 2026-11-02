import {
  archiveSupplierRequestSchema,
  createPurchaseRequestSchema,
  createSupplierPaymentRequestSchema,
  createSupplierRequestSchema,
  listPurchasesQuerySchema,
  listSuppliersQuerySchema,
  receivePurchaseRequestSchema,
  updateSupplierRequestSchema,
  voidPurchaseRequestSchema,
} from "@pisto/contracts";
import type { PurchasesRepository } from "@pisto/db";

import { commandResponse, contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes, queryContract } from "./protected.ts";

const supplierNotFound = "Supplier was not found";
const purchaseNotFound = "Purchase was not found";

export function purchasesRoutes(input: { access: ProductAccess; purchases: PurchasesRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get(
    "/suppliers",
    async ({ actor, query }) => {
      return { data: await input.purchases.listSuppliers(actor, query) };
    },
    { ...queryContract(listSuppliersQuerySchema, "Supplier list filters are invalid") },
  );

  routes.post(
    "/suppliers",
    async ({ actor, body }) => {
      return commandResponse(await input.purchases.createSupplier(actor, body));
    },
    {
      parse: "json",
      body: contract(createSupplierRequestSchema, "Supplier details are invalid"),
    },
  );

  routes.get(
    "/suppliers/:supplierId",
    async ({ actor, params }) => {
      return { data: await input.purchases.getSupplier(actor, params.supplierId) };
    },
    { record: { supplierId: supplierNotFound } },
  );

  routes.patch(
    "/suppliers/:supplierId",
    async ({ actor, body, params }) => {
      return { data: await input.purchases.updateSupplier(actor, params.supplierId, body) };
    },
    {
      body: contract(updateSupplierRequestSchema, "Supplier changes are invalid"),
      record: { supplierId: supplierNotFound },
    },
  );

  routes.post(
    "/suppliers/:supplierId/archive",
    async ({ actor, body, params }) => {
      return { data: await input.purchases.archiveSupplier(actor, params.supplierId, body) };
    },
    {
      body: contract(archiveSupplierRequestSchema, "Supplier archive confirmation is invalid"),
      record: { supplierId: supplierNotFound },
    },
  );

  routes.get("/payables/summary", async ({ actor }) => {
    return { data: await input.purchases.getPayablesSummary(actor) };
  });

  routes.get(
    "/purchases",
    async ({ actor, query }) => {
      return { data: await input.purchases.listPurchases(actor, query) };
    },
    { ...queryContract(listPurchasesQuerySchema, "Purchase list filters are invalid") },
  );

  routes.post(
    "/purchases",
    async ({ actor, body }) => {
      return commandResponse(await input.purchases.createPurchase(actor, body));
    },
    {
      parse: "json",
      body: contract(createPurchaseRequestSchema, "Purchase details are invalid"),
    },
  );

  routes.get(
    "/purchases/:purchaseId",
    async ({ actor, params }) => {
      return { data: await input.purchases.getPurchase(actor, params.purchaseId) };
    },
    { record: { purchaseId: purchaseNotFound } },
  );

  routes.post(
    "/purchases/:purchaseId/receive",
    async ({ actor, body, params }) => {
      return { data: await input.purchases.receivePurchase(actor, params.purchaseId, body) };
    },
    {
      body: contract(receivePurchaseRequestSchema, "Purchase receipt confirmation is invalid"),
      record: { purchaseId: purchaseNotFound },
    },
  );

  routes.post(
    "/purchases/:purchaseId/void",
    async ({ actor, body, params }) => {
      return { data: await input.purchases.voidPurchase(actor, params.purchaseId, body) };
    },
    {
      body: contract(voidPurchaseRequestSchema, "Purchase void confirmation is invalid"),
      record: { purchaseId: purchaseNotFound },
    },
  );

  routes.post(
    "/purchases/:purchaseId/payments",
    async ({ actor, body, params }) => {
      return commandResponse(
        await input.purchases.createSupplierPayment(actor, params.purchaseId, body),
      );
    },
    {
      body: contract(
        createSupplierPaymentRequestSchema,
        "Supplier payment confirmation is invalid",
      ),
      record: { purchaseId: purchaseNotFound },
    },
  );
  return routes;
}
