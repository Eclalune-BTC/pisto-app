import { and, eq, sql } from "drizzle-orm";

import type { AuthorizedBusinessContext, DatabaseTransaction } from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { customer, receivable } from "../schema/receivables.ts";
import { getPaidMinorUnits, loadReceivable } from "./records.ts";

/**
 * Receivables' owner port for itemized sales (ADR 0016): the sale command coordinates the
 * transaction, while customer status and the receivable lifecycle stay here.
 */

/**
 * The active customer a sale names. FOR SHARE conflicts with a concurrent archive, which must
 * then wait for the sale and see the debt it created.
 */
export async function requireSaleCustomer(
  tx: DatabaseTransaction,
  businessId: string,
  customerId: string,
): Promise<{ id: string; name: string }> {
  const [record] = await tx
    .select({ id: customer.id, name: customer.name, status: customer.status })
    .from(customer)
    .where(and(eq(customer.businessId, businessId), eq(customer.id, customerId)))
    .limit(1)
    .for("share");
  if (!record) throw new ProductError("NOT_FOUND", "Customer was not found");
  if (record.status !== "active") {
    throw new ProductError("CONFLICT", "An archived customer cannot buy on credit or be named");
  }
  return { id: record.id, name: record.name };
}

/** The unpaid balance of a sale becomes one posted receivable due on the agreed date. */
export async function postSaleReceivable(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  input: {
    actorUserId: string;
    customerId: string;
    description: string;
    dueDate: string;
    originalMinorUnits: bigint;
    postedDate: string;
  },
): Promise<string> {
  const [record] = await tx
    .insert(receivable)
    .values({
      businessId: access.businessId,
      customerId: input.customerId,
      originalMinorUnits: input.originalMinorUnits,
      currency: access.currency,
      currencyMinorUnitDigits: access.currencyMinorUnitDigits,
      description: input.description,
      postedDate: input.postedDate,
      dueDate: input.dueDate,
      createdByUserId: input.actorUserId,
    })
    .returning({ id: receivable.id });
  if (!record) throw new Error("Sale receivable insert returned no record");
  return record.id;
}

/** A voided sale voids its debt, unless the customer already paid part of it. */
export async function voidSaleReceivable(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  input: { actorUserId: string; reason: string; receivableId: string },
): Promise<void> {
  const existing = await loadReceivable(tx, access, input.receivableId, true);
  if (existing.status !== "posted") {
    throw new ProductError("CONFLICT", "The sale's receivable is already voided");
  }
  if ((await getPaidMinorUnits(tx, access.businessId, input.receivableId)) !== 0n) {
    throw new ProductError(
      "CONFLICT",
      "Reverse the payments applied to this sale's receivable before voiding the sale",
    );
  }
  await tx
    .update(receivable)
    .set({
      status: "voided",
      voidedAt: sql`transaction_timestamp()`,
      voidedByUserId: input.actorUserId,
      voidReason: input.reason,
    })
    .where(
      and(eq(receivable.businessId, access.businessId), eq(receivable.id, input.receivableId)),
    );
}
