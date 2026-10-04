import { listReceivablesQuerySchema } from "@pisto/contracts";
import { and, desc, eq, sql } from "drizzle-orm";

import { authorizeBusinessAction } from "../business-access.ts";
import type { Database } from "../client.ts";
import { parseInput } from "../errors.ts";
import {
  decodeCursor,
  exactCursorTimestamp,
  keysetBefore,
  listFilterFingerprint,
  pageRows,
} from "../pagination.ts";
import { receivable, receivablePayment } from "../schema/receivables.ts";
import { toPayment, toReceivable } from "./mappers.ts";
import { businessLocalDate, currentReceivable, loadReceivable, paymentTotals } from "./records.ts";
import type { ReceivablesRepository } from "./types.ts";

type ReceivableQueries = Pick<
  ReceivablesRepository,
  "getReceivable" | "getSummary" | "listReceivables"
>;

type ListRow = {
  created_at: Date | string;
  createdAtExact: string;
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
      const query = parseInput(
        listReceivablesQuerySchema,
        rawQuery,
        "Receivable list filters are invalid",
      );
      const filterFingerprint = await listFilterFingerprint("receivables", {
        customerId: query.customerId ?? null,
        state: query.state,
      });
      const cursor = decodeCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["receivables:read"]);
        const localDate = businessLocalDate(access.timeZone);
        const scope = and(
          eq(receivable.businessId, access.businessId),
          query.customerId ? eq(receivable.customerId, query.customerId) : undefined,
          keysetBefore(receivable, cursor),
        );
        // The state is derived from payments and the business-local date, so the
        // filter applies after derivation rather than to a stored column.
        const rows = await tx.execute<ListRow>(sql`
          with payment_totals as (${paymentTotals(access.businessId)}),
          derived as (
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
              ${exactCursorTimestamp(receivable.createdAt)} as "createdAtExact",
              ${receivable.updatedAt} as updated_at,
              ${localDate} as local_date,
              case
                when ${receivable.status} = 'voided' then 'voided'
                when ${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric) = 0 then 'paid'
                when ${receivable.dueDate} is not null and ${receivable.dueDate} < ${localDate}
                  then 'overdue'
                else 'open'
              end as state
            from ${receivable}
            left join payment_totals on payment_totals.receivable_id = ${receivable.id}
            where ${scope}
          )
          select * from derived
          ${query.state === "all" ? sql`` : sql`where state = ${query.state}`}
          order by created_at desc, id desc
          limit ${query.limit + 1}
        `);
        const page = pageRows(rows, query.limit, filterFingerprint);
        return {
          items: page.rows.map((row) =>
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
          ),
          nextCursor: page.nextCursor,
        };
      });
    },

    async getReceivable(actor, receivableId) {
      return db.transaction(
        async (tx) => {
          const access = await authorizeBusinessAction(tx, actor, ["receivables:read"], "none");
          const record = await loadReceivable(tx, access, receivableId, false);
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
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },

    async getSummary(actor) {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["receivables:read"]);
        type SummaryRow = {
          business_local_date: string;
          open_count: string;
          outstanding: string;
          overdue: string;
          overdue_count: string;
        };
        const localDate = businessLocalDate(access.timeZone);
        const [row] = await tx.execute<SummaryRow>(sql`
          with payment_totals as (${paymentTotals(access.businessId)}),
          balances as (
            select
              (${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric)) as outstanding,
              ${receivable.dueDate} < ${localDate} as overdue
            from ${receivable}
            left join payment_totals on payment_totals.receivable_id = ${receivable.id}
            where ${receivable.businessId} = ${access.businessId}
              and ${receivable.status} = 'posted'
          )
          select
            coalesce(sum(outstanding), 0::numeric)::text as outstanding,
            coalesce(sum(case when overdue and outstanding > 0 then outstanding else 0 end), 0::numeric)::text as overdue,
            count(*) filter (where outstanding > 0)::text as open_count,
            count(*) filter (where overdue and outstanding > 0)::text as overdue_count,
            ${localDate} as business_local_date
          from balances
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
          queriedAt: access.queriedAt.toISOString(),
        };
      });
    },
  };
}
