import type { Auth } from "@pisto/auth";
import {
  createBusinessRequestSchema,
  createSaleRequestSchema,
  replaceSaleRequestSchema,
  voidSaleRequestSchema,
} from "@pisto/contracts";
import { ProductError, type ProductRepository } from "@pisto/db";
import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../errors.ts";
import { parseJsonBody } from "../http.ts";
import { requireSession, toProductActor } from "../session.ts";
import type { AppEnv } from "../types.ts";

const saleIdSchema = z.string().uuid();

function mapProductError(error: unknown): never {
  if (!(error instanceof ProductError)) throw error;
  switch (error.code) {
    case "BUSINESS_REQUIRED":
      throw new ApiError(409, "BUSINESS_REQUIRED", error.message);
    case "IDEMPOTENCY_CONFLICT":
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", error.message);
    case "CONFLICT":
      throw new ApiError(409, "CONFLICT", error.message);
    case "FORBIDDEN":
      throw new ApiError(403, "FORBIDDEN", error.message);
    case "NOT_FOUND":
      throw new ApiError(404, "NOT_FOUND", error.message);
    case "UNAUTHORIZED":
      throw new ApiError(401, "UNAUTHORIZED", error.message);
    case "VALIDATION_ERROR":
      throw new ApiError(400, "VALIDATION_ERROR", error.message);
  }
}

export function productRoutes(input: { auth: Auth; product: ProductRepository }) {
  const routes = new Hono<AppEnv>();

  routes.get("/businesses", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    return context.json({ data: await input.product.listBusinesses(toProductActor(authSession)) });
  });

  routes.post("/businesses", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const body = createBusinessRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Business settings are invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.product.createBusiness(toProductActor(authSession), body.data);
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.post("/sales", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const body = createSaleRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Sale confirmation is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.product.createSale(toProductActor(authSession), body.data);
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.get("/sales/summary/previous-month", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    try {
      const summary = await input.product.getPreviousMonthSummary(toProductActor(authSession));
      return context.json({ data: { summary } });
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.post("/sales/:saleId/void", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const saleId = saleIdSchema.safeParse(context.req.param("saleId"));
    if (!saleId.success) throw new ApiError(404, "NOT_FOUND", "Sale was not found");
    const body = voidSaleRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Sale correction is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.product.voidSale(
        toProductActor(authSession),
        saleId.data,
        body.data,
      );
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.post("/sales/:saleId/replace", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const saleId = saleIdSchema.safeParse(context.req.param("saleId"));
    if (!saleId.success) throw new ApiError(404, "NOT_FOUND", "Sale was not found");
    const body = replaceSaleRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Replacement sale is invalid",
        body.error.flatten(),
      );
    }
    try {
      const result = await input.product.replaceSale(
        toProductActor(authSession),
        saleId.data,
        body.data,
      );
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.get("/sales/:saleId", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const saleId = saleIdSchema.safeParse(context.req.param("saleId"));
    if (!saleId.success) throw new ApiError(404, "NOT_FOUND", "Sale was not found");
    try {
      const sale = await input.product.getSale(toProductActor(authSession), saleId.data);
      return context.json({ data: { sale, replayed: false as const } });
    } catch (error) {
      return mapProductError(error);
    }
  });

  return routes;
}
