import type { Auth } from "@pisto/auth";
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
import { Hono } from "hono";

import { commandStatus, parseJsonBody, parseRequest, requireRecordId } from "../http.ts";
import { requireActor } from "../session.ts";
import type { AppEnv } from "../types.ts";

const customerNotFound = "Customer was not found";
const receivableNotFound = "Receivable was not found";
const paymentNotFound = "Receivable payment was not found";

export function receivablesRoutes(input: { auth: Auth; receivables: ReceivablesRepository }) {
  const routes = new Hono<AppEnv>();

  routes.get("/customers", async (context) => {
    const actor = await requireActor(input.auth, context);
    // These two list routes read named parameters instead of the whole query
    // record. Their contracts are strict, so forwarding every parameter would
    // turn an unrelated tracking parameter into a 400 the clients do not expect.
    const query = parseRequest(
      listCustomersQuerySchema,
      {
        cursor: context.req.query("cursor"),
        limit: context.req.query("limit"),
        query: context.req.query("query"),
        status: context.req.query("status"),
      },
      "Customer list filters are invalid",
    );
    return context.json({ data: await input.receivables.listCustomers(actor, query) });
  });

  routes.post("/customers", async (context) => {
    const actor = await requireActor(input.auth, context);
    const command = parseRequest(
      createCustomerRequestSchema,
      await parseJsonBody(context),
      "Customer details are invalid",
    );
    const result = await input.receivables.createCustomer(actor, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.get("/customers/:customerId", async (context) => {
    const actor = await requireActor(input.auth, context);
    const customerId = requireRecordId(context.req.param("customerId"), customerNotFound);
    return context.json({ data: await input.receivables.getCustomer(actor, customerId) });
  });

  routes.post("/customers/:customerId/update", async (context) => {
    const actor = await requireActor(input.auth, context);
    const customerId = requireRecordId(context.req.param("customerId"), customerNotFound);
    const command = parseRequest(
      updateCustomerRequestSchema,
      await parseJsonBody(context),
      "Customer changes are invalid",
    );
    return context.json({
      data: await input.receivables.updateCustomer(actor, customerId, command),
    });
  });

  routes.post("/customers/:customerId/archive", async (context) => {
    const actor = await requireActor(input.auth, context);
    const customerId = requireRecordId(context.req.param("customerId"), customerNotFound);
    const command = parseRequest(
      archiveCustomerRequestSchema,
      await parseJsonBody(context),
      "Customer archive confirmation is invalid",
    );
    return context.json({
      data: await input.receivables.archiveCustomer(actor, customerId, command),
    });
  });

  routes.get("/receivables/summary", async (context) => {
    const actor = await requireActor(input.auth, context);
    const summary = await input.receivables.getSummary(actor);
    return context.json({ data: { summary } });
  });

  routes.get("/receivables", async (context) => {
    const actor = await requireActor(input.auth, context);
    const query = parseRequest(
      listReceivablesQuerySchema,
      {
        cursor: context.req.query("cursor"),
        customerId: context.req.query("customerId"),
        limit: context.req.query("limit"),
        state: context.req.query("state"),
      },
      "Receivable list filters are invalid",
    );
    return context.json({ data: await input.receivables.listReceivables(actor, query) });
  });

  routes.post("/receivables", async (context) => {
    const actor = await requireActor(input.auth, context);
    const command = parseRequest(
      postReceivableRequestSchema,
      await parseJsonBody(context),
      "Receivable details are invalid",
    );
    const result = await input.receivables.postReceivable(actor, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.get("/receivables/:receivableId", async (context) => {
    const actor = await requireActor(input.auth, context);
    const receivableId = requireRecordId(context.req.param("receivableId"), receivableNotFound);
    return context.json({ data: await input.receivables.getReceivable(actor, receivableId) });
  });

  routes.post("/receivables/:receivableId/void", async (context) => {
    const actor = await requireActor(input.auth, context);
    const receivableId = requireRecordId(context.req.param("receivableId"), receivableNotFound);
    const command = parseRequest(
      voidReceivableRequestSchema,
      await parseJsonBody(context),
      "Receivable void confirmation is invalid",
    );
    return context.json({
      data: await input.receivables.voidReceivable(actor, receivableId, command),
    });
  });

  routes.post("/receivables/:receivableId/payments", async (context) => {
    const actor = await requireActor(input.auth, context);
    const receivableId = requireRecordId(context.req.param("receivableId"), receivableNotFound);
    const command = parseRequest(
      applyReceivablePaymentRequestSchema,
      await parseJsonBody(context),
      "Receivable payment confirmation is invalid",
    );
    const result = await input.receivables.applyPayment(actor, receivableId, command);
    return context.json({ data: result }, commandStatus(result));
  });

  routes.post("/receivable-payments/:paymentId/reverse", async (context) => {
    const actor = await requireActor(input.auth, context);
    const paymentId = requireRecordId(context.req.param("paymentId"), paymentNotFound);
    const command = parseRequest(
      reverseReceivablePaymentRequestSchema,
      await parseJsonBody(context),
      "Payment reversal confirmation is invalid",
    );
    const result = await input.receivables.reversePayment(actor, paymentId, command);
    return context.json({ data: result }, commandStatus(result));
  });

  return routes;
}
