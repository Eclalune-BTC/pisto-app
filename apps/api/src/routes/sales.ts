import {
  createItemizedSaleRequestSchema,
  createSaleRequestSchema,
  replaceSaleRequestSchema,
  saleListQuerySchema,
  saleReviewActionRequestSchema,
  saleReviewDismissRequestSchema,
  voidSaleRequestSchema,
} from "@pisto/contracts";
import type { SalesRepository } from "@pisto/db";

import { commandResponse, contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes, queryContract } from "./protected.ts";

const saleNotFound = "Sale was not found";

export function salesRoutes(input: { access: ProductAccess; sales: SalesRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get(
    "/sales",
    async ({ actor, query }) => {
      return { data: await input.sales.listSales(actor, query) };
    },
    {
      ...queryContract(saleListQuerySchema, "Sale list filters are invalid"),
    },
  );

  routes.post(
    "/sales",
    async ({ actor, body }) => {
      return commandResponse(await input.sales.createSale(actor, body));
    },
    {
      parse: "json",
      body: contract(createSaleRequestSchema, "Sale confirmation is invalid"),
    },
  );

  routes.post(
    "/sales/itemized",
    async ({ actor, body }) => {
      return commandResponse(await input.sales.createItemizedSale(actor, body));
    },
    {
      parse: "json",
      body: contract(createItemizedSaleRequestSchema, "Itemized sale is invalid"),
    },
  );

  routes.get("/sales/form-options", async ({ actor }) => {
    return { data: await input.sales.getSaleFormOptions(actor) };
  });

  routes.get("/sales/review", async ({ actor }) => {
    return { data: { review: await input.sales.getSaleReview(actor) } };
  });

  routes.post(
    "/sales/review",
    async ({ actor, body }) => {
      return {
        data: { review: await input.sales.prepareSaleReview(actor, body) },
      };
    },
    {
      parse: "json",
      body: contract(createSaleRequestSchema, "Sale review is invalid"),
    },
  );

  routes.post(
    "/sales/review/:reviewId/confirm",
    async ({ actor, params }) => {
      return commandResponse(await input.sales.confirmSaleReview(actor, params.reviewId));
    },
    {
      body: contract(saleReviewActionRequestSchema, "Sale review action is invalid"),
      record: { reviewId: "Sale review was not found" },
    },
  );

  routes.post(
    "/sales/review/:reviewId/dismiss",
    async ({ actor, body, params }) => {
      return {
        data: await input.sales.dismissSaleReview(actor, params.reviewId, body.acknowledgedSaleId),
      };
    },
    {
      body: contract(saleReviewDismissRequestSchema, "Sale review dismissal is invalid"),
      record: { reviewId: "Sale review was not found" },
    },
  );

  routes.get("/sales/summary/previous-month", async ({ actor }) => {
    const summary = await input.sales.getPreviousMonthSummary(actor);
    return { data: { summary } };
  });

  routes.post(
    "/sales/:saleId/void",
    async ({ actor, body, params }) => {
      return commandResponse(await input.sales.voidSale(actor, params.saleId, body));
    },
    {
      body: contract(voidSaleRequestSchema, "Sale correction is invalid"),
      record: { saleId: saleNotFound },
    },
  );

  routes.post(
    "/sales/:saleId/replace",
    async ({ actor, body, params }) => {
      return commandResponse(await input.sales.replaceSale(actor, params.saleId, body));
    },
    {
      body: contract(replaceSaleRequestSchema, "Replacement sale is invalid"),
      record: { saleId: saleNotFound },
    },
  );

  routes.get(
    "/sales/:saleId",
    async ({ actor, params }) => {
      const { sale, details } = await input.sales.getSale(actor, params.saleId);
      return { data: { sale, details, replayed: false as const } };
    },
    {
      record: { saleId: saleNotFound },
    },
  );
  return routes;
}
