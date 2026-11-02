import { purchaseSchema, supplierPaymentSchema } from "@pisto/contracts";
import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import type {
  AuthorizedBusinessContext,
  BusinessDatabaseExecutor,
  DatabaseTransaction,
} from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { sumLedger } from "../money.ts";
import type { OperationLog } from "../operation-log.ts";
import { getBusinessLocalDate } from "../receivables/records.ts";
import {
  purchase,
  purchaseLine,
  purchaseOperation,
  supplier,
  supplierPayment,
} from "../schema/purchases.ts";
import { DUE_SOON_DAYS, toPurchase } from "./mappers.ts";
import type { PurchaseLineRecord, PurchaseRecord, SupplierRecord } from "./types.ts";

export const purchaseOperationLog = {
  conflictMessage: "That confirmation key was already used for a different purchase operation",
  result: purchaseOperation.resultSnapshot,
  table: purchaseOperation,
} satisfies OperationLog<typeof purchaseOperation>;

export const paymentResultSchema = z.object({
  payment: supplierPaymentSchema,
  purchase: purchaseSchema,
});

/** `(purchase_id, paid)` for every purchase of the business with supplier payments. */
export function supplierPaymentTotals(businessId: string): SQL {
  return sql`select
      ${supplierPayment.purchaseId} as purchase_id,
      sum(${supplierPayment.amountMinorUnits}) as paid
    from ${supplierPayment}
    where ${supplierPayment.businessId} = ${businessId}
    group by ${supplierPayment.purchaseId}`;
}

/**
 * The outstanding balance of a `purchase` row joined to `supplierPaymentTotals` as
 * `payment_totals`; a cash purchase was paid in full when it was recorded.
 */
export function purchaseBalance(): SQL<string> {
  return sql<string>`case
    when ${purchase.status} = 'voided' then 0::numeric
    when ${purchase.paymentTerms} = 'cash' then 0::numeric - coalesce(payment_totals.paid, 0::numeric)
    else ${purchase.totalMinorUnits} - coalesce(payment_totals.paid, 0::numeric)
  end`;
}

export function businessLocalDateSql(timeZone: string, plusDays = 0): SQL<string> {
  return sql<string>`to_char((transaction_timestamp() at time zone ${timeZone})::date + ${plusDays}::integer, 'YYYY-MM-DD')`;
}

export function dueSoonLimitSql(timeZone: string): SQL<string> {
  return businessLocalDateSql(timeZone, DUE_SOON_DAYS);
}

export function getSupplierPaymentsMinorUnits(
  executor: BusinessDatabaseExecutor,
  businessId: string,
  purchaseId: string,
): Promise<bigint> {
  return sumLedger(
    executor,
    {
      table: supplierPayment,
      amount: supplierPayment.amountMinorUnits,
      where: and(
        eq(supplierPayment.businessId, businessId),
        eq(supplierPayment.purchaseId, purchaseId),
      ),
    },
    "Supplier payment total",
  );
}

export async function lockSupplier(
  tx: DatabaseTransaction,
  businessId: string,
  supplierId: string,
  mode: "share" | "update",
): Promise<SupplierRecord> {
  const [record] = await tx
    .select()
    .from(supplier)
    .where(and(eq(supplier.businessId, businessId), eq(supplier.id, supplierId)))
    .limit(1)
    .for(mode);
  if (!record) throw new ProductError("NOT_FOUND", "Supplier was not found");
  return record;
}

export async function loadPurchase(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  purchaseId: string,
  lock: boolean,
): Promise<PurchaseRecord> {
  const query = tx
    .select()
    .from(purchase)
    .where(and(eq(purchase.businessId, access.businessId), eq(purchase.id, purchaseId)))
    .limit(1);
  const [record] = lock ? await query.for("update") : await query;
  if (!record) throw new ProductError("NOT_FOUND", "Purchase was not found");
  return record;
}

export async function loadLines(
  executor: BusinessDatabaseExecutor,
  businessId: string,
  purchaseIds: readonly string[],
): Promise<Map<string, PurchaseLineRecord[]>> {
  const lines = new Map<string, PurchaseLineRecord[]>();
  if (purchaseIds.length === 0) return lines;
  const records = await executor
    .select()
    .from(purchaseLine)
    .where(
      and(
        eq(purchaseLine.businessId, businessId),
        inArray(purchaseLine.purchaseId, [...purchaseIds]),
      ),
    )
    .orderBy(purchaseLine.purchaseId, purchaseLine.position);
  for (const record of records) {
    const existing = lines.get(record.purchaseId);
    if (existing) existing.push(record);
    else lines.set(record.purchaseId, [record]);
  }
  return lines;
}

export async function loadSupplierNames(
  executor: BusinessDatabaseExecutor,
  businessId: string,
  supplierIds: readonly string[],
): Promise<Map<string, string>> {
  if (supplierIds.length === 0) return new Map();
  const rows = await executor
    .select({ id: supplier.id, name: supplier.name })
    .from(supplier)
    .where(and(eq(supplier.businessId, businessId), inArray(supplier.id, [...supplierIds])));
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** The public read model of one purchase, from its current lines, payments and business date. */
export async function currentPurchase(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  record: PurchaseRecord,
) {
  const [lines, paymentsMinorUnits, localDate, names] = await Promise.all([
    loadLines(tx, access.businessId, [record.id]),
    getSupplierPaymentsMinorUnits(tx, access.businessId, record.id),
    getBusinessLocalDate(tx, access),
    loadSupplierNames(tx, access.businessId, [record.supplierId]),
  ]);
  const supplierName = names.get(record.supplierId);
  if (!supplierName) throw new Error("Purchase supplier is missing");
  return toPurchase(record, {
    lines: lines.get(record.id) ?? [],
    localDate,
    paymentsMinorUnits,
    supplierName,
  });
}

/** The current business-local minute from the database clock, for commands without a date. */
export async function businessNow(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
): Promise<{ occurredAt: Date; occurredLocalDate: string; occurredLocalTime: string }> {
  const [row] = await tx.execute<{
    local_date: string;
    local_time: string;
    occurred_at: Date | string;
  }>(sql`
    select
      date_trunc('minute', transaction_timestamp()) as occurred_at,
      to_char(transaction_timestamp() at time zone ${access.timeZone}, 'YYYY-MM-DD') as local_date,
      to_char(transaction_timestamp() at time zone ${access.timeZone}, 'HH24:MI') as local_time
  `);
  if (!row) throw new Error("Database clock returned no row");
  return {
    occurredAt: new Date(row.occurred_at),
    occurredLocalDate: row.local_date,
    occurredLocalTime: row.local_time,
  };
}
