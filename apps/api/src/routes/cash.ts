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
import { Hono } from "hono";

import { commandStatus, parseJsonBody, parseRequest, requireRecordId } from "../http.ts";
import { requireActor } from "../session.ts";
import type { AppEnv } from "../types.ts";

const accountNotFound = "Cash account was not found";
const movementNotFound = "Cash movement was not found";
const expenseNotFound = "Expense was not found";

export function cashRoutes(input: { auth: Auth; cash: CashRepository }) {
  const routes = new Hono<AppEnv>();

  routes.get("/cash/accounts", async (context) => {
    const actor = await requireActor(input.auth, context);
    const query = parseRequest(
      cashAccountListQuerySchema,
      context.req.query(),
      "Cash account list query is invalid",
    );
    return context.json({ data: await input.cash.listAccounts(actor, query) });
  });

  routes.post("/cash/accounts", async (context) => {
    const actor = await requireActor(input.auth, context);
    const command = parseRequest(
      createCashAccountRequestSchema,
      await parseJsonBody(context),
      "Cash account confirmation is invalid",
    );
    const result = await input.cash.createAccount(actor, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.post("/cash/accounts/:accountId/update", async (context) => {
    const actor = await requireActor(input.auth, context);
    const accountId = requireRecordId(context.req.param("accountId"), accountNotFound);
    const command = parseRequest(
      updateCashAccountRequestSchema,
      await parseJsonBody(context),
      "Cash account update is invalid",
    );
    return context.json({ data: await input.cash.updateAccount(actor, accountId, command) });
  });

  routes.post("/cash/accounts/:accountId/archive", async (context) => {
    const actor = await requireActor(input.auth, context);
    const accountId = requireRecordId(context.req.param("accountId"), accountNotFound);
    const command = parseRequest(
      archiveCashAccountRequestSchema,
      await parseJsonBody(context),
      "Cash account archive is invalid",
    );
    return context.json({ data: await input.cash.archiveAccount(actor, accountId, command) });
  });

  routes.get("/cash/accounts/:accountId", async (context) => {
    const actor = await requireActor(input.auth, context);
    const accountId = requireRecordId(context.req.param("accountId"), accountNotFound);
    const account = await input.cash.getAccount(actor, accountId);
    return context.json({ data: { account } });
  });

  routes.post("/cash/adjustments", async (context) => {
    const actor = await requireActor(input.auth, context);
    const command = parseRequest(
      recordCashAdjustmentRequestSchema,
      await parseJsonBody(context),
      "Cash adjustment is invalid",
    );
    const result = await input.cash.recordAdjustment(actor, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.post("/cash/movements/:movementId/reverse", async (context) => {
    const actor = await requireActor(input.auth, context);
    const movementId = requireRecordId(context.req.param("movementId"), movementNotFound);
    const command = parseRequest(
      reverseCashMovementRequestSchema,
      await parseJsonBody(context),
      "Cash reversal is invalid",
    );
    const result = await input.cash.reverseAdjustment(actor, movementId, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.post("/cash/transfers", async (context) => {
    const actor = await requireActor(input.auth, context);
    const command = parseRequest(
      transferCashRequestSchema,
      await parseJsonBody(context),
      "Cash transfer is invalid",
    );
    const result = await input.cash.transfer(actor, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.get("/cash/movements", async (context) => {
    const actor = await requireActor(input.auth, context);
    const query = parseRequest(
      cashMovementListQuerySchema,
      context.req.query(),
      "Cash movement list query is invalid",
    );
    return context.json({ data: await input.cash.listMovements(actor, query) });
  });

  routes.get("/expenses/summary", async (context) => {
    const actor = await requireActor(input.auth, context);
    const query = parseRequest(
      expensePeriodQuerySchema,
      context.req.query(),
      "Expense period is invalid",
    );
    const summary = await input.cash.getExpensePeriodSummary(actor, query);
    return context.json({ data: { summary } });
  });

  routes.get("/expenses", async (context) => {
    const actor = await requireActor(input.auth, context);
    const query = parseRequest(
      expenseListQuerySchema,
      context.req.query(),
      "Expense list query is invalid",
    );
    return context.json({ data: await input.cash.listExpenses(actor, query) });
  });

  routes.post("/expenses", async (context) => {
    const actor = await requireActor(input.auth, context);
    const command = parseRequest(
      postExpenseRequestSchema,
      await parseJsonBody(context),
      "Expense confirmation is invalid",
    );
    const result = await input.cash.postExpense(actor, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.post("/expenses/:expenseId/void", async (context) => {
    const actor = await requireActor(input.auth, context);
    const expenseId = requireRecordId(context.req.param("expenseId"), expenseNotFound);
    const command = parseRequest(
      voidExpenseRequestSchema,
      await parseJsonBody(context),
      "Expense void confirmation is invalid",
    );
    return context.json({ data: await input.cash.voidExpense(actor, expenseId, command) });
  });

  routes.get("/expenses/:expenseId", async (context) => {
    const actor = await requireActor(input.auth, context);
    const expenseId = requireRecordId(context.req.param("expenseId"), expenseNotFound);
    const expenseRecord = await input.cash.getExpense(actor, expenseId);
    return context.json({ data: { expense: expenseRecord } });
  });

  return routes;
}
