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

const accountNotFound = "Cash account was not found";
const movementNotFound = "Cash movement was not found";
const expenseNotFound = "Expense was not found";

import { commandResponse, contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes } from "./protected.ts";

export function cashRoutes(input: { access: ProductAccess; cash: CashRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get(
    "/cash/accounts",
    async ({ actor, query }) => {
      return { data: await input.cash.listAccounts(actor, query) };
    },
    {
      query: contract(cashAccountListQuerySchema, "Cash account list query is invalid"),
      queryPolicy: "first",
    },
  );

  routes.post(
    "/cash/accounts",
    async ({ actor, body }) => {
      return commandResponse(await input.cash.createAccount(actor, body));
    },
    {
      parse: "json",
      body: contract(createCashAccountRequestSchema, "Cash account confirmation is invalid"),
    },
  );

  routes.post(
    "/cash/accounts/:accountId/update",
    async ({ actor, body, params }) => {
      return { data: await input.cash.updateAccount(actor, params.accountId, body) };
    },
    {
      body: contract(updateCashAccountRequestSchema, "Cash account update is invalid"),
      record: { accountId: accountNotFound },
    },
  );

  routes.post(
    "/cash/accounts/:accountId/archive",
    async ({ actor, body, params }) => {
      return { data: await input.cash.archiveAccount(actor, params.accountId, body) };
    },
    {
      body: contract(archiveCashAccountRequestSchema, "Cash account archive is invalid"),
      record: { accountId: accountNotFound },
    },
  );

  routes.get(
    "/cash/accounts/:accountId",
    async ({ actor, params }) => {
      const account = await input.cash.getAccount(actor, params.accountId);
      return { data: { account } };
    },
    {
      record: { accountId: accountNotFound },
    },
  );

  routes.post(
    "/cash/adjustments",
    async ({ actor, body }) => {
      return commandResponse(await input.cash.recordAdjustment(actor, body));
    },
    {
      parse: "json",
      body: contract(recordCashAdjustmentRequestSchema, "Cash adjustment is invalid"),
    },
  );

  routes.post(
    "/cash/movements/:movementId/reverse",
    async ({ actor, body, params }) => {
      return commandResponse(await input.cash.reverseAdjustment(actor, params.movementId, body));
    },
    {
      body: contract(reverseCashMovementRequestSchema, "Cash reversal is invalid"),
      record: { movementId: movementNotFound },
    },
  );

  routes.post(
    "/cash/transfers",
    async ({ actor, body }) => {
      return commandResponse(await input.cash.transfer(actor, body));
    },
    {
      parse: "json",
      body: contract(transferCashRequestSchema, "Cash transfer is invalid"),
    },
  );

  routes.get(
    "/cash/movements",
    async ({ actor, query }) => {
      return { data: await input.cash.listMovements(actor, query) };
    },
    {
      query: contract(cashMovementListQuerySchema, "Cash movement list query is invalid"),
      queryPolicy: "first",
    },
  );

  routes.get(
    "/expenses/summary",
    async ({ actor, query }) => {
      const summary = await input.cash.getExpensePeriodSummary(actor, query);
      return { data: { summary } };
    },
    {
      query: contract(expensePeriodQuerySchema, "Expense period is invalid"),
      queryPolicy: "first",
    },
  );

  routes.get(
    "/expenses",
    async ({ actor, query }) => {
      return { data: await input.cash.listExpenses(actor, query) };
    },
    {
      query: contract(expenseListQuerySchema, "Expense list query is invalid"),
      queryPolicy: "first",
    },
  );

  routes.post(
    "/expenses",
    async ({ actor, body }) => {
      return commandResponse(await input.cash.postExpense(actor, body));
    },
    {
      parse: "json",
      body: contract(postExpenseRequestSchema, "Expense confirmation is invalid"),
    },
  );

  routes.post(
    "/expenses/:expenseId/void",
    async ({ actor, body, params }) => {
      return { data: await input.cash.voidExpense(actor, params.expenseId, body) };
    },
    {
      body: contract(voidExpenseRequestSchema, "Expense void confirmation is invalid"),
      record: { expenseId: expenseNotFound },
    },
  );

  routes.get(
    "/expenses/:expenseId",
    async ({ actor, params }) => {
      const expenseRecord = await input.cash.getExpense(actor, params.expenseId);
      return { data: { expense: expenseRecord } };
    },
    {
      record: { expenseId: expenseNotFound },
    },
  );
  return routes;
}
