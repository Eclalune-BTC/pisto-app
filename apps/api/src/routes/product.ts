import type { Auth } from "@pisto/auth";
import {
  createBusinessRequestSchema,
  createSaleRequestSchema,
  replaceSaleRequestSchema,
  voidSaleRequestSchema,
} from "@pisto/contracts";
import type { ProductRepository } from "@pisto/db";
import { Hono } from "hono";

import { commandStatus, parseJsonBody, parseRequest, requireRecordId } from "../http.ts";
import { requireActor } from "../session.ts";
import type { AppEnv } from "../types.ts";

const saleNotFound = "Sale was not found";

export function productRoutes(input: { auth: Auth; product: ProductRepository }) {
  const routes = new Hono<AppEnv>();

  routes.get("/businesses", async (context) => {
    const actor = await requireActor(input.auth, context);
    return context.json({ data: await input.product.listBusinesses(actor) });
  });

  routes.post("/businesses", async (context) => {
    const actor = await requireActor(input.auth, context);
    const command = parseRequest(
      createBusinessRequestSchema,
      await parseJsonBody(context),
      "Business settings are invalid",
    );
    const result = await input.product.createBusiness(actor, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.post("/sales", async (context) => {
    const actor = await requireActor(input.auth, context);
    const command = parseRequest(
      createSaleRequestSchema,
      await parseJsonBody(context),
      "Sale confirmation is invalid",
    );
    const result = await input.product.createSale(actor, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.get("/sales/summary/previous-month", async (context) => {
    const actor = await requireActor(input.auth, context);
    const summary = await input.product.getPreviousMonthSummary(actor);
    return context.json({ data: { summary } });
  });

  routes.post("/sales/:saleId/void", async (context) => {
    const actor = await requireActor(input.auth, context);
    const saleId = requireRecordId(context.req.param("saleId"), saleNotFound);
    const command = parseRequest(
      voidSaleRequestSchema,
      await parseJsonBody(context),
      "Sale correction is invalid",
    );
    const result = await input.product.voidSale(actor, saleId, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.post("/sales/:saleId/replace", async (context) => {
    const actor = await requireActor(input.auth, context);
    const saleId = requireRecordId(context.req.param("saleId"), saleNotFound);
    const command = parseRequest(
      replaceSaleRequestSchema,
      await parseJsonBody(context),
      "Replacement sale is invalid",
    );
    const result = await input.product.replaceSale(actor, saleId, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.get("/sales/:saleId", async (context) => {
    const actor = await requireActor(input.auth, context);
    const saleId = requireRecordId(context.req.param("saleId"), saleNotFound);
    const sale = await input.product.getSale(actor, saleId);
    return context.json({ data: { sale, replayed: false as const } });
  });

  return routes;
}
