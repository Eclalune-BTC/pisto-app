import {
  createBusinessRequestSchema,
  createSaleRequestSchema,
  replaceSaleRequestSchema,
  saleListQuerySchema,
  saleReviewActionRequestSchema,
  saleReviewDismissRequestSchema,
  voidSaleRequestSchema,
} from "@pisto/contracts";
import type { ProductRepository } from "@pisto/db";

const saleNotFound = "Sale was not found";

import { commandResponse, contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes, queryContract } from "./protected.ts";

export function productRoutes(input: { access: ProductAccess; product: ProductRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get("/businesses", async ({ actor }) => {
    return { data: await input.product.listBusinesses(actor) };
  });

  routes.post(
    "/businesses",
    async ({ actor, body }) => {
      return commandResponse(await input.product.createBusiness(actor, body));
    },
    {
      parse: "json",
      body: contract(createBusinessRequestSchema, "Business settings are invalid"),
    },
  );

  routes.get(
    "/sales",
    async ({ actor, query }) => {
      return { data: await input.product.listSales(actor, query) };
    },
    {
      ...queryContract(saleListQuerySchema, "Sale list filters are invalid"),
    },
  );

  routes.post(
    "/sales",
    async ({ actor, body }) => {
      return commandResponse(await input.product.createSale(actor, body));
    },
    {
      parse: "json",
      body: contract(createSaleRequestSchema, "Sale confirmation is invalid"),
    },
  );

  routes.get("/sales/review", async ({ actor }) => {
    return { data: { review: await input.product.getSaleReview(actor) } };
  });

  routes.post(
    "/sales/review",
    async ({ actor, body }) => {
      return {
        data: { review: await input.product.prepareSaleReview(actor, body) },
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
      return commandResponse(await input.product.confirmSaleReview(actor, params.reviewId));
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
        data: await input.product.dismissSaleReview(
          actor,
          params.reviewId,
          body.acknowledgedSaleId,
        ),
      };
    },
    {
      body: contract(saleReviewDismissRequestSchema, "Sale review dismissal is invalid"),
      record: { reviewId: "Sale review was not found" },
    },
  );

  routes.get("/sales/summary/previous-month", async ({ actor }) => {
    const summary = await input.product.getPreviousMonthSummary(actor);
    return { data: { summary } };
  });

  routes.post(
    "/sales/:saleId/void",
    async ({ actor, body, params }) => {
      return commandResponse(await input.product.voidSale(actor, params.saleId, body));
    },
    {
      body: contract(voidSaleRequestSchema, "Sale correction is invalid"),
      record: { saleId: saleNotFound },
    },
  );

  routes.post(
    "/sales/:saleId/replace",
    async ({ actor, body, params }) => {
      return commandResponse(await input.product.replaceSale(actor, params.saleId, body));
    },
    {
      body: contract(replaceSaleRequestSchema, "Replacement sale is invalid"),
      record: { saleId: saleNotFound },
    },
  );

  routes.get(
    "/sales/:saleId",
    async ({ actor, params }) => {
      const sale = await input.product.getSale(actor, params.saleId);
      return { data: { sale, replayed: false as const } };
    },
    {
      record: { saleId: saleNotFound },
    },
  );
  return routes;
}
