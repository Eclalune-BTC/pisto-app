import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { listCustomersQuerySchema } from "../../../contracts/src/receivables.ts";

import type { Database } from "../client.ts";
import { ProductError } from "../product.ts";
import { customer, receivable, receivablePayment } from "../schema/receivables.ts";
import { authorize } from "./access.ts";
import { decodeCursor, encodeCursor, sha256, uuidPattern, validate } from "./codec.ts";
import { toCustomer } from "./mappers.ts";
import type { ReceivablesRepository } from "./types.ts";

type CustomerQueries = Pick<ReceivablesRepository, "getCustomer" | "listCustomers">;

export function createCustomerQueries(db: Database): CustomerQueries {
  return {
    async listCustomers(actor, rawQuery) {
      const query = validate(
        listCustomersQuerySchema,
        rawQuery,
        "Customer list filters are invalid",
      );
      const filterFingerprint = await sha256({
        kind: "customers",
        query: query.query ?? null,
        status: query.status,
        version: 1,
      });
      const cursor = query.cursor ? decodeCursor(query.cursor, filterFingerprint) : null;
      return db.transaction(async (tx) => {
        const access = await authorize(tx, actor, "customers:read");
        const conditions = [eq(customer.businessId, access.businessId)];
        if (query.status !== "all") conditions.push(eq(customer.status, query.status));
        if (query.query) {
          const escaped = query.query.replace(/[\\%_]/g, "\\$&");
          const pattern = `%${escaped}%`;
          conditions.push(
            or(
              sql`${customer.name} ilike ${pattern} escape '\\'`,
              sql`${customer.email} ilike ${pattern} escape '\\'`,
              sql`${customer.phone} ilike ${pattern} escape '\\'`,
            ) as ReturnType<typeof eq>,
          );
        }
        if (cursor) {
          const createdAt = new Date(cursor.createdAt);
          conditions.push(
            or(
              lt(customer.createdAt, createdAt),
              and(eq(customer.createdAt, createdAt), lt(customer.id, cursor.id)),
            ) as ReturnType<typeof eq>,
          );
        }
        const rows = await tx
          .select()
          .from(customer)
          .where(and(...conditions))
          .orderBy(desc(customer.createdAt), desc(customer.id))
          .limit(query.limit + 1);
        const hasMore = rows.length > query.limit;
        const page = rows.slice(0, query.limit);
        const last = page.at(-1);
        return {
          items: page.map(toCustomer),
          nextCursor:
            hasMore && last
              ? encodeCursor({
                  createdAt: last.createdAt.toISOString(),
                  filterFingerprint,
                  id: last.id,
                  version: 1,
                })
              : null,
        };
      });
    },

    async getCustomer(actor, customerId) {
      if (!uuidPattern.test(customerId)) {
        throw new ProductError("NOT_FOUND", "Customer was not found");
      }
      return db.transaction(async (tx) => {
        const access = await authorize(tx, actor, "customers:read");
        const [record] = await tx
          .select()
          .from(customer)
          .where(and(eq(customer.businessId, access.businessId), eq(customer.id, customerId)))
          .limit(1);
        if (!record) throw new ProductError("NOT_FOUND", "Customer was not found");
        type BalanceRow = {
          open_count: string;
          outstanding: string;
          overdue: string;
          overdue_count: string;
          queried_at: Date | string;
        };
        const [balance] = await tx.execute<BalanceRow>(sql`
          with payment_totals as (
            select
              ${receivablePayment.receivableId} as receivable_id,
              coalesce(sum(case
                when ${receivablePayment.kind} = 'payment' then ${receivablePayment.amountMinorUnits}
                else -${receivablePayment.amountMinorUnits}
              end), 0::numeric) as paid
            from ${receivablePayment}
            where ${receivablePayment.businessId} = ${access.businessId}
            group by ${receivablePayment.receivableId}
          ), balances as (
            select
              ${receivable.id},
              (${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric)) as outstanding,
              ${receivable.dueDate} < to_char(transaction_timestamp() at time zone ${access.timeZone}, 'YYYY-MM-DD') as overdue
            from ${receivable}
            left join payment_totals on payment_totals.receivable_id = ${receivable.id}
            where ${receivable.businessId} = ${access.businessId}
              and ${receivable.customerId} = ${customerId}
              and ${receivable.status} = 'posted'
          )
          select
            coalesce(sum(outstanding), 0::numeric)::text as outstanding,
            coalesce(sum(case when overdue and outstanding > 0 then outstanding else 0 end), 0::numeric)::text as overdue,
            count(*) filter (where outstanding > 0)::text as open_count,
            count(*) filter (where overdue and outstanding > 0)::text as overdue_count,
            transaction_timestamp() as queried_at
          from balances
        `);
        if (!balance) throw new Error("Customer balance query returned no row");
        return {
          customer: toCustomer(record),
          balance: {
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            outstandingMinorUnits: balance.outstanding,
            overdueMinorUnits: balance.overdue,
            openReceivableCount: balance.open_count,
            overdueReceivableCount: balance.overdue_count,
            queriedAt: new Date(balance.queried_at).toISOString(),
          },
        };
      });
    },
  };
}
