import { listCustomersQuerySchema } from "@pisto/contracts";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";

import { authorizeBusinessAction } from "../business-access.ts";
import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import {
  decodeCursor,
  exactCursorTimestamp,
  keysetBefore,
  listFilterFingerprint,
  pageRows,
} from "../pagination.ts";
import { customer, receivable } from "../schema/receivables.ts";
import { containsText } from "../text-search.ts";
import { toCustomer } from "./mappers.ts";
import { businessLocalDate, paymentTotals } from "./records.ts";
import type { ReceivablesRepository } from "./types.ts";

type CustomerQueries = Pick<ReceivablesRepository, "getCustomer" | "listCustomers">;

export function createCustomerQueries(db: Database): CustomerQueries {
  return {
    async listCustomers(actor, rawQuery) {
      const query = parseInput(
        listCustomersQuerySchema,
        rawQuery,
        "Customer list filters are invalid",
      );
      const filterFingerprint = await listFilterFingerprint("customers", {
        query: query.query ?? null,
        status: query.status,
      });
      const cursor = decodeCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["customers:read"]);
        const rows = await tx
          .select({
            ...getTableColumns(customer),
            createdAtExact: exactCursorTimestamp(customer.createdAt),
          })
          .from(customer)
          .where(
            and(
              eq(customer.businessId, access.businessId),
              query.status === "all" ? undefined : eq(customer.status, query.status),
              query.query
                ? containsText([customer.name, customer.email, customer.phone], query.query)
                : undefined,
              keysetBefore(customer, cursor),
            ),
          )
          .orderBy(desc(customer.createdAt), desc(customer.id))
          .limit(query.limit + 1);
        const page = pageRows(rows, query.limit, filterFingerprint);
        return { items: page.rows.map(toCustomer), nextCursor: page.nextCursor };
      });
    },

    async getCustomer(actor, customerId) {
      return db.transaction(
        async (tx) => {
          const access = await authorizeBusinessAction(tx, actor, ["customers:read"], "none");
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
          };
          const [balance] = await tx.execute<BalanceRow>(sql`
            with payment_totals as (${paymentTotals(access.businessId)}),
            balances as (
              select
                (${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric)) as outstanding,
                ${receivable.dueDate} < ${businessLocalDate(access.timeZone)} as overdue
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
              count(*) filter (where overdue and outstanding > 0)::text as overdue_count
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
              queriedAt: access.queriedAt.toISOString(),
            },
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
