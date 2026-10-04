import { and, eq, type SQL, sql } from "drizzle-orm";

import type {
  AuthorizedBusinessContext,
  BusinessDatabaseExecutor,
  DatabaseTransaction,
} from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { sumLedger } from "../money.ts";
import type { OperationLog } from "../operation-log.ts";
import { receivable, receivableOperation, receivablePayment } from "../schema/receivables.ts";
import { toReceivable } from "./mappers.ts";
import type { ReceivableRecord } from "./types.ts";

export const receivableOperationLog = {
  conflictMessage: "That confirmation key was already used for a different operation",
  result: receivableOperation.resultSnapshot,
  table: receivableOperation,
} satisfies OperationLog<typeof receivableOperation>;

/** A payment row adds to the paid amount; a reversal row subtracts the payment it undoes. */
const signedPaymentAmount = sql`case
  when ${receivablePayment.kind} = 'payment' then ${receivablePayment.amountMinorUnits}
  else -${receivablePayment.amountMinorUnits}
end`;

/**
 * `(receivable_id, paid)` for every receivable of the business that has payment rows.
 * Callers left-join it and treat a missing row as nothing paid.
 */
export function paymentTotals(businessId: string): SQL {
  return sql`select
      ${receivablePayment.receivableId} as receivable_id,
      sum(${signedPaymentAmount}) as paid
    from ${receivablePayment}
    where ${receivablePayment.businessId} = ${businessId}
    group by ${receivablePayment.receivableId}`;
}

export function businessLocalDate(timeZone: string): SQL<string> {
  return sql<string>`to_char(transaction_timestamp() at time zone ${timeZone}, 'YYYY-MM-DD')`;
}

export async function getBusinessLocalDate(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
): Promise<string> {
  const [clock] = await tx.execute<{ local_date: string }>(
    sql`select ${businessLocalDate(access.timeZone)} as local_date`,
  );
  if (!clock) throw new Error("Database clock returned no row");
  return clock.local_date;
}

export function getPaidMinorUnits(
  executor: BusinessDatabaseExecutor,
  businessId: string,
  receivableId: string,
): Promise<bigint> {
  return sumLedger(
    executor,
    {
      table: receivablePayment,
      amount: signedPaymentAmount,
      where: and(
        eq(receivablePayment.businessId, businessId),
        eq(receivablePayment.receivableId, receivableId),
      ),
    },
    "Receivable payment total",
  );
}

export async function loadReceivable(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  receivableId: string,
  lock: boolean,
): Promise<ReceivableRecord> {
  const query = tx
    .select()
    .from(receivable)
    .where(and(eq(receivable.businessId, access.businessId), eq(receivable.id, receivableId)))
    .limit(1);
  const [record] = lock ? await query.for("update") : await query;
  if (!record) throw new ProductError("NOT_FOUND", "Receivable was not found");
  return record;
}

export async function currentReceivable(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  record: ReceivableRecord,
) {
  const [paidMinorUnits, localDate] = await Promise.all([
    getPaidMinorUnits(tx, access.businessId, record.id),
    getBusinessLocalDate(tx, access),
  ]);
  return toReceivable(record, paidMinorUnits, localDate);
}
