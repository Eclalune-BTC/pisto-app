import type { Auth } from "@pisto/auth";
import { ProductError } from "@pisto/db";
import { Hono } from "hono";
import { z } from "zod";
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
} from "../../../../packages/contracts/src/receivables.ts";
import type { ReceivablesRepository } from "../../../../packages/db/src/receivables.ts";

import { ApiError } from "../errors.ts";
import { parseJsonBody } from "../http.ts";
import { requireSession, toProductActor } from "../session.ts";
import type { AppEnv } from "../types.ts";

const recordIdSchema = z.string().uuid();

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

function invalidBody(message: string, details: unknown): never {
  throw new ApiError(400, "VALIDATION_ERROR", message, details);
}

function parseRecordId(value: string, message: string): string {
  const parsed = recordIdSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(404, "NOT_FOUND", message);
  return parsed.data;
}

export function receivablesRoutes(input: { auth: Auth; receivables: ReceivablesRepository }) {
  const routes = new Hono<AppEnv>();

  routes.get("/customers", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const query = listCustomersQuerySchema.safeParse({
      cursor: context.req.query("cursor"),
      limit: context.req.query("limit"),
      query: context.req.query("query"),
      status: context.req.query("status"),
    });
    if (!query.success) {
      return invalidBody("Customer list filters are invalid", query.error.flatten());
    }
    try {
      const result = await input.receivables.listCustomers(toProductActor(authSession), query.data);
      return context.json({ data: result });
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.post("/customers", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const body = createCustomerRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) return invalidBody("Customer details are invalid", body.error.flatten());
    try {
      const result = await input.receivables.createCustomer(toProductActor(authSession), body.data);
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.get("/customers/:customerId", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const customerId = parseRecordId(context.req.param("customerId"), "Customer was not found");
    try {
      const result = await input.receivables.getCustomer(toProductActor(authSession), customerId);
      return context.json({ data: result });
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.post("/customers/:customerId/update", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const customerId = parseRecordId(context.req.param("customerId"), "Customer was not found");
    const body = updateCustomerRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) return invalidBody("Customer changes are invalid", body.error.flatten());
    try {
      const result = await input.receivables.updateCustomer(
        toProductActor(authSession),
        customerId,
        body.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.post("/customers/:customerId/archive", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const customerId = parseRecordId(context.req.param("customerId"), "Customer was not found");
    const body = archiveCustomerRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      return invalidBody("Customer archive confirmation is invalid", body.error.flatten());
    }
    try {
      const result = await input.receivables.archiveCustomer(
        toProductActor(authSession),
        customerId,
        body.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.get("/receivables/summary", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    try {
      const summary = await input.receivables.getSummary(toProductActor(authSession));
      return context.json({ data: { summary } });
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.get("/receivables", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const query = listReceivablesQuerySchema.safeParse({
      cursor: context.req.query("cursor"),
      customerId: context.req.query("customerId"),
      limit: context.req.query("limit"),
      state: context.req.query("state"),
    });
    if (!query.success) {
      return invalidBody("Receivable list filters are invalid", query.error.flatten());
    }
    try {
      const result = await input.receivables.listReceivables(
        toProductActor(authSession),
        query.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.post("/receivables", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const body = postReceivableRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) return invalidBody("Receivable details are invalid", body.error.flatten());
    try {
      const result = await input.receivables.postReceivable(toProductActor(authSession), body.data);
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.get("/receivables/:receivableId", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const receivableId = parseRecordId(
      context.req.param("receivableId"),
      "Receivable was not found",
    );
    try {
      const result = await input.receivables.getReceivable(
        toProductActor(authSession),
        receivableId,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.post("/receivables/:receivableId/void", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const receivableId = parseRecordId(
      context.req.param("receivableId"),
      "Receivable was not found",
    );
    const body = voidReceivableRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      return invalidBody("Receivable void confirmation is invalid", body.error.flatten());
    }
    try {
      const result = await input.receivables.voidReceivable(
        toProductActor(authSession),
        receivableId,
        body.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.post("/receivables/:receivableId/payments", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const receivableId = parseRecordId(
      context.req.param("receivableId"),
      "Receivable was not found",
    );
    const body = applyReceivablePaymentRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      return invalidBody("Receivable payment confirmation is invalid", body.error.flatten());
    }
    try {
      const result = await input.receivables.applyPayment(
        toProductActor(authSession),
        receivableId,
        body.data,
      );
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapProductError(error);
    }
  });

  routes.post("/receivable-payments/:paymentId/reverse", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const paymentId = parseRecordId(
      context.req.param("paymentId"),
      "Receivable payment was not found",
    );
    const body = reverseReceivablePaymentRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      return invalidBody("Payment reversal confirmation is invalid", body.error.flatten());
    }
    try {
      const result = await input.receivables.reversePayment(
        toProductActor(authSession),
        paymentId,
        body.data,
      );
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapProductError(error);
    }
  });

  return routes;
}
