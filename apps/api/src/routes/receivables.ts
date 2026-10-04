import {
  applyReceivablePaymentRequestSchema,
  archiveCustomerRequestSchema,
  createCustomerRequestSchema,
  listCustomersQuerySchema,
  listReceivablesQuerySchema,
  postReceivableRequestSchema,
  reverseReceivablePaymentRequestSchema,
  updateCustomerRequestSchema,
  voidReceivableRequestSchema,
} from "@pisto/contracts";
import type { ReceivablesRepository } from "@pisto/db";

const customerNotFound = "Customer was not found";
const receivableNotFound = "Receivable was not found";
const paymentNotFound = "Receivable payment was not found";

import { commandResponse, contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes, queryContract } from "./protected.ts";

export function receivablesRoutes(input: {
  access: ProductAccess;
  receivables: ReceivablesRepository;
}) {
  const routes = protectedRoutes(input.access);
  routes.get(
    "/customers",
    async ({ actor, query }) => {
      return { data: await input.receivables.listCustomers(actor, query) };
    },
    {
      ...queryContract(listCustomersQuerySchema, "Customer list filters are invalid"),
    },
  );

  routes.post(
    "/customers",
    async ({ actor, body }) => {
      return commandResponse(await input.receivables.createCustomer(actor, body));
    },
    {
      parse: "json",
      body: contract(createCustomerRequestSchema, "Customer details are invalid"),
    },
  );

  routes.get(
    "/customers/:customerId",
    async ({ actor, params }) => {
      return { data: await input.receivables.getCustomer(actor, params.customerId) };
    },
    {
      record: { customerId: customerNotFound },
    },
  );

  routes.post(
    "/customers/:customerId/update",
    async ({ actor, body, params }) => {
      return {
        data: await input.receivables.updateCustomer(actor, params.customerId, body),
      };
    },
    {
      body: contract(updateCustomerRequestSchema, "Customer changes are invalid"),
      record: { customerId: customerNotFound },
    },
  );

  routes.post(
    "/customers/:customerId/archive",
    async ({ actor, body, params }) => {
      return {
        data: await input.receivables.archiveCustomer(actor, params.customerId, body),
      };
    },
    {
      body: contract(archiveCustomerRequestSchema, "Customer archive confirmation is invalid"),
      record: { customerId: customerNotFound },
    },
  );

  routes.get("/receivables/summary", async ({ actor }) => {
    const summary = await input.receivables.getSummary(actor);
    return { data: { summary } };
  });

  routes.get(
    "/receivables",
    async ({ actor, query }) => {
      return { data: await input.receivables.listReceivables(actor, query) };
    },
    {
      ...queryContract(listReceivablesQuerySchema, "Receivable list filters are invalid"),
    },
  );

  routes.post(
    "/receivables",
    async ({ actor, body }) => {
      return commandResponse(await input.receivables.postReceivable(actor, body));
    },
    {
      parse: "json",
      body: contract(postReceivableRequestSchema, "Receivable details are invalid"),
    },
  );

  routes.get(
    "/receivables/:receivableId",
    async ({ actor, params }) => {
      return { data: await input.receivables.getReceivable(actor, params.receivableId) };
    },
    {
      record: { receivableId: receivableNotFound },
    },
  );

  routes.post(
    "/receivables/:receivableId/void",
    async ({ actor, body, params }) => {
      return {
        data: await input.receivables.voidReceivable(actor, params.receivableId, body),
      };
    },
    {
      body: contract(voidReceivableRequestSchema, "Receivable void confirmation is invalid"),
      record: { receivableId: receivableNotFound },
    },
  );

  routes.post(
    "/receivables/:receivableId/payments",
    async ({ actor, body, params }) => {
      return commandResponse(
        await input.receivables.applyPayment(actor, params.receivableId, body),
      );
    },
    {
      body: contract(
        applyReceivablePaymentRequestSchema,
        "Receivable payment confirmation is invalid",
      ),
      record: { receivableId: receivableNotFound },
    },
  );

  routes.post(
    "/receivable-payments/:paymentId/reverse",
    async ({ actor, body, params }) => {
      return commandResponse(await input.receivables.reversePayment(actor, params.paymentId, body));
    },
    {
      body: contract(
        reverseReceivablePaymentRequestSchema,
        "Payment reversal confirmation is invalid",
      ),
      record: { paymentId: paymentNotFound },
    },
  );
  return routes;
}
