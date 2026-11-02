import type { SaleCorrection } from "@pisto/contracts";
import { saleListQuerySchema } from "@pisto/contracts";
import { and, desc, eq, getTableColumns, inArray, or, sql } from "drizzle-orm";

import { authorizeBusinessAction } from "../business-access.ts";
import { listSalePaymentAccounts } from "../cash/sale-ledger.ts";
import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import {
  decodeOccurrenceCursor,
  exactCursorTimestamp,
  listFilterFingerprint,
  occurrenceKeysetBefore,
  pageOccurrenceRows,
} from "../pagination.ts";
import { customer } from "../schema/receivables.ts";
import { sale, saleCorrection } from "../schema/sales.ts";
import { readSaleDetails } from "./itemized.ts";
import { toCorrection, toSale } from "./records.ts";
import type { SalesRepository } from "./types.ts";

type SaleQueries = Pick<
  SalesRepository,
  "getPreviousMonthSummary" | "getSale" | "getSaleFormOptions" | "listSales"
>;

/** The current name of the customer a sale names, joined on the same business. */
const saleCustomerJoin = and(
  eq(customer.businessId, sale.businessId),
  eq(customer.id, sale.customerId),
);

export function createSaleQueries(db: Database): SaleQueries {
  return {
    async listSales(actor, rawQuery) {
      const query = parseInput(saleListQuerySchema, rawQuery, "Sale list filters are invalid");
      const filterFingerprint = await listFilterFingerprint("sales", { status: query.status });
      const cursor = decodeOccurrenceCursor(query.cursor, filterFingerprint);

      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["sales:read"]);
        const rows = await tx
          .select({
            ...getTableColumns(sale),
            customerName: customer.name,
            occurredAtExact: exactCursorTimestamp(sale.occurredAt),
            createdAtExact: exactCursorTimestamp(sale.createdAt),
          })
          .from(sale)
          .leftJoin(customer, saleCustomerJoin)
          .where(
            and(
              eq(sale.businessId, access.businessId),
              query.status === "all" ? undefined : eq(sale.status, query.status),
              occurrenceKeysetBefore(sale, cursor),
            ),
          )
          .orderBy(desc(sale.occurredAt), desc(sale.createdAt), desc(sale.id))
          .limit(query.limit + 1);
        const page = pageOccurrenceRows(rows, query.limit, filterFingerprint);
        const pageIds = page.rows.map(({ id }) => id);
        // A sale is never both an original and a replacement, but only the
        // application enforces that. Joining the correction table could still fan
        // the page out, so the links are read separately over the page ids.
        const correctionRecords =
          pageIds.length === 0
            ? []
            : await tx
                .select()
                .from(saleCorrection)
                .where(
                  and(
                    eq(saleCorrection.businessId, access.businessId),
                    or(
                      inArray(saleCorrection.originalSaleId, pageIds),
                      inArray(saleCorrection.replacementSaleId, pageIds),
                    ),
                  ),
                );
        const correctionsBySaleId = new Map<string, SaleCorrection>();
        for (const record of correctionRecords) {
          const correction = toCorrection(record);
          correctionsBySaleId.set(record.originalSaleId, correction);
          if (record.replacementSaleId) {
            correctionsBySaleId.set(record.replacementSaleId, correction);
          }
        }
        const items = page.rows.map((record) => {
          const correction = correctionsBySaleId.get(record.id) ?? null;
          if (record.status === "voided" && correction === null) {
            throw new Error("A voided sale is missing its correction record");
          }
          return toSale(record, correction, record.customerName);
        });
        return {
          items,
          nextCursor: page.nextCursor,
          queriedAt: access.queriedAt.toISOString(),
        };
      });
    },

    async getSale(actor, saleId) {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["sales:read"]);
        // The sale and its correction link are read in one statement so a concurrent
        // correction cannot pair a posted status with a void record or the reverse.
        const [result] = await tx
          .select({ record: sale, correction: saleCorrection, customerName: customer.name })
          .from(sale)
          .leftJoin(customer, saleCustomerJoin)
          .leftJoin(
            saleCorrection,
            and(
              eq(saleCorrection.businessId, sale.businessId),
              or(
                eq(saleCorrection.originalSaleId, sale.id),
                eq(saleCorrection.replacementSaleId, sale.id),
              ),
            ),
          )
          .where(and(eq(sale.businessId, access.businessId), eq(sale.id, saleId)))
          .limit(1);
        if (!result) throw new ProductError("NOT_FOUND", "Sale was not found");
        return {
          sale: toSale(
            result.record,
            result.correction ? toCorrection(result.correction) : null,
            result.customerName,
          ),
          details: await readSaleDetails(tx, result.record, result.customerName),
        };
      });
    },

    async getSaleFormOptions(actor) {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["sales:create"]);
        return { accounts: await listSalePaymentAccounts(tx, access.businessId) };
      });
    },

    async getPreviousMonthSummary(actor) {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["sales:summary:read"]);
        type SummaryRow = {
          average_minor_units: string | null;
          gross_minor_units: string;
          period_end_local_exclusive: string;
          period_end_utc_exclusive: Date | string;
          period_start_local: string;
          period_start_utc: Date | string;
          sale_count: string;
        };
        const [row] = await tx.execute<SummaryRow>(sql`
          with bounds as (
            select
              date_trunc('month', transaction_timestamp() at time zone ${access.timeZone}) - interval '1 month' as start_local,
              date_trunc('month', transaction_timestamp() at time zone ${access.timeZone}) as end_local
          ), instants as (
            select
              start_local,
              end_local,
              start_local at time zone ${access.timeZone} as start_utc,
              end_local at time zone ${access.timeZone} as end_utc
            from bounds
          ), totals as (
            select
              coalesce(sum(${sale.grossMinorUnits}), 0::numeric) as gross,
              count(${sale.id})::bigint as sale_count
            from instants
            left join ${sale}
              on ${sale.businessId} = ${access.businessId}
              and ${sale.status} = 'posted'
              and ${sale.occurredAt} >= instants.start_utc
              and ${sale.occurredAt} < instants.end_utc
          )
          select
            to_char(instants.start_local, 'YYYY-MM-DD') as period_start_local,
            to_char(instants.end_local, 'YYYY-MM-DD') as period_end_local_exclusive,
            instants.start_utc as period_start_utc,
            instants.end_utc as period_end_utc_exclusive,
            totals.gross::text as gross_minor_units,
            totals.sale_count::text as sale_count,
            case
              when totals.sale_count = 0 then null
              else floor(totals.gross / totals.sale_count + 0.5)::text
            end as average_minor_units
          from instants, totals
        `);
        if (!row) throw new Error("Previous-month summary query returned no row");
        return {
          periodStartLocal: row.period_start_local,
          periodEndLocalExclusive: row.period_end_local_exclusive,
          periodStartUtc: new Date(row.period_start_utc).toISOString(),
          periodEndUtcExclusive: new Date(row.period_end_utc_exclusive).toISOString(),
          timeZone: access.timeZone,
          currency: access.currency,
          currencyMinorUnitDigits: access.currencyMinorUnitDigits,
          grossMinorUnits: row.gross_minor_units,
          saleCount: row.sale_count,
          averageMinorUnits: row.average_minor_units,
          queriedAt: access.queriedAt.toISOString(),
        };
      });
    },
  };
}
