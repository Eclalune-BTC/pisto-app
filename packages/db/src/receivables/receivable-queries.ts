import { listReceivablesQuerySchema } from "@pisto/contracts";
import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "../client.ts";
import { fingerprintValue } from "../operation-log.ts";
import { ProductError } from "../product.ts";
import { receivable, receivablePayment } from "../schema/receivables.ts";
import { authorize, currentReceivable, loadReceivable } from "./access.ts";
import { decodeCursor, encodeCursor, uuidPattern, validate } from "./codec.ts";
import { toPayment, toReceivable } from "./mappers.ts";
import type { ReceivablesRepository } from "./types.ts";

type ReceivableQueries = Pick<
  ReceivablesRepository,
  "getReceivable" | "getSummary" | "listReceivables"
>;

type ListRow = {
  created_at: Date | string;
  created_by_user_id: string;
  currency: string;
  currency_minor_unit_digits: number;
  customer_id: string;
  description: string;
  due_date: string | null;
  id: string;
  local_date: string;
  original_minor_units: string;
  paid_minor_units: string;
  posted_date: string;
  status: string;
  updated_at: Date | string;
  void_reason: string | null;
  voided_at: Date | string | null;
  voided_by_user_id: string | null;
};

export function createReceivableQueries(db: Database): ReceivableQueries {
  return {
    async listReceivables(actor, rawQuery) {
      const query = validate(
        listReceivablesQuerySchema,
        rawQuery,
        "Receivable list filters are invalid",
      );
      const filterFingerprint = await fingerprintValue({
        customerId: query.customerId ?? null,
        kind: "receivables",
        state: query.state,
        version: 1,
      });
      const cursor = query.cursor ? decodeCursor(query.cursor, filterFingerprint) : null;
      return db.transaction(async (tx) => {
        const access = await authorize(tx, actor, "receivables:read");
        const customerFilter = query.customerId
          ? sql`and ${receivable.customerId} = ${query.customerId}`
          : sql``;
        const cursorFilter = cursor
          ? sql`and (
              ${receivable.createdAt} < ${new Date(cursor.createdAt)}
              or (${receivable.createdAt} = ${new Date(cursor.createdAt)} and ${receivable.id} < ${cursor.id})
            )`
          : sql``;
        const stateFilter = query.state === "all" ? sql`` : sql`where state = ${query.state}`;
        const rows = await tx.execute<ListRow>(sql`
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
          ), derived as (
            select
              ${receivable.id} as id,
              ${receivable.customerId} as customer_id,
              ${receivable.status} as status,
              ${receivable.originalMinorUnits}::text as original_minor_units,
              coalesce(payment_totals.paid, 0::numeric)::text as paid_minor_units,
              ${receivable.currency} as currency,
              ${receivable.currencyMinorUnitDigits} as currency_minor_unit_digits,
              ${receivable.description} as description,
              ${receivable.postedDate} as posted_date,
              ${receivable.dueDate} as due_date,
              ${receivable.createdByUserId} as created_by_user_id,
              ${receivable.voidedByUserId} as voided_by_user_id,
              ${receivable.voidedAt} as voided_at,
              ${receivable.voidReason} as void_reason,
              ${receivable.createdAt} as created_at,
              ${receivable.updatedAt} as updated_at,
              to_char(transaction_timestamp() at time zone ${access.timeZone}, 'YYYY-MM-DD') as local_date,
              case
                when ${receivable.status} = 'voided' then 'voided'
                when ${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric) = 0 then 'paid'
                when ${receivable.dueDate} is not null
                  and ${receivable.dueDate} < to_char(transaction_timestamp() at time zone ${access.timeZone}, 'YYYY-MM-DD')
                  then 'overdue'
                else 'open'
              end as state
            from ${receivable}
            left join payment_totals on payment_totals.receivable_id = ${receivable.id}
            where ${receivable.businessId} = ${access.businessId}
              ${customerFilter}
              ${cursorFilter}
          )
          select
            id,
            customer_id,
            status,
            original_minor_units,
            paid_minor_units,
            currency,
            currency_minor_unit_digits,
            description,
            posted_date,
            due_date,
            created_by_user_id,
            voided_by_user_id,
            voided_at,
            void_reason,
            created_at,
            updated_at,
            local_date
          from derived
          ${stateFilter}
          order by created_at desc, id desc
          limit ${query.limit + 1}
        `);
        const hasMore = rows.length > query.limit;
        const page = rows.slice(0, query.limit);
        const items = page.map((row) =>
          toReceivable(
            {
              id: row.id,
              businessId: access.businessId,
              customerId: row.customer_id,
              status: row.status,
              originalMinorUnits: BigInt(row.original_minor_units),
              currency: row.currency,
              currencyMinorUnitDigits: row.currency_minor_unit_digits,
              description: row.description,
              postedDate: row.posted_date,
              dueDate: row.due_date,
              createdByUserId: row.created_by_user_id,
              voidedByUserId: row.voided_by_user_id,
              voidedAt: row.voided_at ? new Date(row.voided_at) : null,
              voidReason: row.void_reason,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at),
            },
            BigInt(row.paid_minor_units),
            row.local_date,
          ),
        );
        const last = page.at(-1);
        return {
          items,
          nextCursor:
            hasMore && last
              ? encodeCursor({
                  createdAt: new Date(last.created_at).toISOString(),
                  filterFingerprint,
                  id: last.id,
                  version: 1,
                })
              : null,
        };
      });
    },

    async getReceivable(actor, receivableId) {
      if (!uuidPattern.test(receivableId)) {
        throw new ProductError("NOT_FOUND", "Receivable was not found");
      }
      return db.transaction(async (tx) => {
        const access = await authorize(tx, actor, "receivables:read");
        const record = await loadReceivable(tx, access, receivableId);
        const paymentRecords = await tx
          .select()
          .from(receivablePayment)
          .where(
            and(
              eq(receivablePayment.businessId, access.businessId),
              eq(receivablePayment.receivableId, receivableId),
            ),
          )
          .orderBy(desc(receivablePayment.createdAt), desc(receivablePayment.id));
        return {
          receivable: await currentReceivable(tx, access, record),
          payments: paymentRecords.map(toPayment),
        };
      });
    },

    async getSummary(actor) {
      return db.transaction(async (tx) => {
        const access = await authorize(tx, actor, "receivables:read");
        type SummaryRow = {
          business_local_date: string;
          open_count: string;
          outstanding: string;
          overdue: string;
          overdue_count: string;
          queried_at: Date | string;
        };
        const [row] = await tx.execute<SummaryRow>(sql`
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
          ), clock as (
            select
              transaction_timestamp() as queried_at,
              to_char(transaction_timestamp() at time zone ${access.timeZone}, 'YYYY-MM-DD') as local_date
          ), balances as (
            select
              (${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric)) as outstanding,
              ${receivable.dueDate} < clock.local_date as overdue
            from ${receivable}
            left join payment_totals on payment_totals.receivable_id = ${receivable.id}
            cross join clock
            where ${receivable.businessId} = ${access.businessId}
              and ${receivable.status} = 'posted'
          ), totals as (
            select
              coalesce(sum(outstanding), 0::numeric)::text as outstanding,
              coalesce(sum(case when overdue and outstanding > 0 then outstanding else 0 end), 0::numeric)::text as overdue,
              count(*) filter (where outstanding > 0)::text as open_count,
              count(*) filter (where overdue and outstanding > 0)::text as overdue_count
            from balances
          )
          select
            totals.outstanding,
            totals.overdue,
            totals.open_count,
            totals.overdue_count,
            clock.local_date as business_local_date,
            clock.queried_at as queried_at
          from totals, clock
        `);
        if (!row) throw new Error("Receivables summary query returned no row");
        return {
          currency: access.currency,
          currencyMinorUnitDigits: access.currencyMinorUnitDigits,
          outstandingMinorUnits: row.outstanding,
          overdueMinorUnits: row.overdue,
          openReceivableCount: row.open_count,
          overdueReceivableCount: row.overdue_count,
          businessLocalDate: row.business_local_date,
          timeZone: access.timeZone,
          queriedAt: new Date(row.queried_at).toISOString(),
        };
      });
    },
  };
}
