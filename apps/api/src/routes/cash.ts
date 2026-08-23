import type { Auth } from "@pisto/auth";
import {
  archiveCashAccountRequestSchema,
  cashAccountListQuerySchema,
  cashMovementListQuerySchema,
  createCashAccountRequestSchema,
  expenseListQuerySchema,
  expensePeriodQuerySchema,
  postExpenseRequestSchema,
  recordCashAdjustmentRequestSchema,
  reverseCashMovementRequestSchema,
  transferCashRequestSchema,
  updateCashAccountRequestSchema,
  voidExpenseRequestSchema,
} from "@pisto/contracts";
import type { CashRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { Hono } from "hono";
import { z } from "zod";

import { ApiError } from "../errors.ts";
import { parseJsonBody } from "../http.ts";
import { requireSession, toProductActor } from "../session.ts";
import type { AppEnv } from "../types.ts";

const resourceIdSchema = z.string().uuid();

function mapCashError(error: unknown): never {
  if (!(error instanceof ProductError)) throw error;
  switch (error.code) {
    case "BUSINESS_REQUIRED":
    case "CONFLICT":
    case "IDEMPOTENCY_CONFLICT":
      throw new ApiError(409, error.code, error.message);
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

function requireResourceId(value: string, resource: string): string {
  const parsed = resourceIdSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(404, "NOT_FOUND", `${resource} was not found`);
  return parsed.data;
}

function invalidRequest(message: string, details: unknown): never {
  throw new ApiError(400, "VALIDATION_ERROR", message, details);
}

export function cashRoutes(input: { auth: Auth; cash: CashRepository }) {
  const routes = new Hono<AppEnv>();

  routes.get("/cash/accounts", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const query = cashAccountListQuerySchema.safeParse(context.req.query());
    if (!query.success) invalidRequest("Cash account list query is invalid", query.error.flatten());
    try {
      return context.json({
        data: await input.cash.listAccounts(toProductActor(authSession), query.data),
      });
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.post("/cash/accounts", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const body = createCashAccountRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) invalidRequest("Cash account confirmation is invalid", body.error.flatten());
    try {
      const result = await input.cash.createAccount(toProductActor(authSession), body.data);
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.post("/cash/accounts/:accountId/update", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const accountId = requireResourceId(context.req.param("accountId"), "Cash account");
    const body = updateCashAccountRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) invalidRequest("Cash account update is invalid", body.error.flatten());
    try {
      const result = await input.cash.updateAccount(
        toProductActor(authSession),
        accountId,
        body.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.post("/cash/accounts/:accountId/archive", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const accountId = requireResourceId(context.req.param("accountId"), "Cash account");
    const body = archiveCashAccountRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) invalidRequest("Cash account archive is invalid", body.error.flatten());
    try {
      const result = await input.cash.archiveAccount(
        toProductActor(authSession),
        accountId,
        body.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.get("/cash/accounts/:accountId", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const accountId = requireResourceId(context.req.param("accountId"), "Cash account");
    try {
      const account = await input.cash.getAccount(toProductActor(authSession), accountId);
      return context.json({ data: { account } });
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.post("/cash/adjustments", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const body = recordCashAdjustmentRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) invalidRequest("Cash adjustment is invalid", body.error.flatten());
    try {
      const result = await input.cash.recordAdjustment(toProductActor(authSession), body.data);
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.post("/cash/movements/:movementId/reverse", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const movementId = requireResourceId(context.req.param("movementId"), "Cash movement");
    const body = reverseCashMovementRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) invalidRequest("Cash reversal is invalid", body.error.flatten());
    try {
      const result = await input.cash.reverseAdjustment(
        toProductActor(authSession),
        movementId,
        body.data,
      );
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.post("/cash/transfers", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const body = transferCashRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) invalidRequest("Cash transfer is invalid", body.error.flatten());
    try {
      const result = await input.cash.transfer(toProductActor(authSession), body.data);
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.get("/cash/movements", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const query = cashMovementListQuerySchema.safeParse(context.req.query());
    if (!query.success)
      invalidRequest("Cash movement list query is invalid", query.error.flatten());
    try {
      return context.json({
        data: await input.cash.listMovements(toProductActor(authSession), query.data),
      });
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.get("/expenses/summary", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const query = expensePeriodQuerySchema.safeParse(context.req.query());
    if (!query.success) invalidRequest("Expense period is invalid", query.error.flatten());
    try {
      const summary = await input.cash.getExpensePeriodSummary(
        toProductActor(authSession),
        query.data,
      );
      return context.json({ data: { summary } });
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.get("/expenses", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const query = expenseListQuerySchema.safeParse(context.req.query());
    if (!query.success) invalidRequest("Expense list query is invalid", query.error.flatten());
    try {
      return context.json({
        data: await input.cash.listExpenses(toProductActor(authSession), query.data),
      });
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.post("/expenses", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const body = postExpenseRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) invalidRequest("Expense confirmation is invalid", body.error.flatten());
    try {
      const result = await input.cash.postExpense(toProductActor(authSession), body.data);
      return context.json({ data: result }, result.replayed ? 200 : 201);
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.post("/expenses/:expenseId/void", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const expenseId = requireResourceId(context.req.param("expenseId"), "Expense");
    const body = voidExpenseRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) invalidRequest("Expense void confirmation is invalid", body.error.flatten());
    try {
      const result = await input.cash.voidExpense(
        toProductActor(authSession),
        expenseId,
        body.data,
      );
      return context.json({ data: result });
    } catch (error) {
      return mapCashError(error);
    }
  });

  routes.get("/expenses/:expenseId", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const expenseId = requireResourceId(context.req.param("expenseId"), "Expense");
    try {
      const expenseRecord = await input.cash.getExpense(toProductActor(authSession), expenseId);
      return context.json({ data: { expense: expenseRecord } });
    } catch (error) {
      return mapCashError(error);
    }
  });

  return routes;
}
