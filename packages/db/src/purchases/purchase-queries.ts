import { listPurchasesQuerySchema } from "@pisto/contracts";
import { and, desc, eq, getTableColumns, type SQL, sql } from "drizzle-orm";

import { authorizeBusinessAction } from "../business-access.ts";
import type { Database } from "../client.ts";
import { parseInput } from "../errors.ts";
import {
  decodeOccurrenceCursor,
  exactCursorTimestamp,
  listFilterFingerprint,
  occurrenceKeysetBefore,
  pageOccurrenceRows,
} from "../pagination.ts";
import { purchase, supplier, supplierPayment } from "../schema/purchases.ts";
import { correlatedSubquery } from "../subquery.ts";
import { toPurchase, toSupplierPayment } from "./mappers.ts";
import {
  businessLocalDateSql,
  currentPurchase,
  dueSoonLimitSql,
  loadLines,
  loadPurchase,
  loadSupplierNames,
  purchaseBalance,
  supplierPaymentTotals,
} from "./records.ts";
import type { PurchasesRepository } from "./types.ts";

type PurchaseQueries = Pick<
  PurchasesRepository,
  "getPayablesSummary" | "getPurchase" | "listPurchases"
>;

/** Supplier payments of the `purchase` row in the enclosing query. */
function paymentsOfPurchase(): SQL<string> {
  return correlatedSubquery<string>(sql`coalesce((
    select sum(${supplierPayment.amountMinorUnits})
    from ${supplierPayment}
    where ${supplierPayment.businessId} = ${purchase.businessId}
      and ${supplierPayment.purchaseId} = ${purchase.id}
  ), 0::numeric)`);
}

/** The outstanding balance of the enclosing `purchase` row, mirroring `derivePayable`. */
function balanceOfPurchase(): SQL<string> {
  return sql<string>`case
    when ${purchase.status} = 'voided' then 0::numeric
    when ${purchase.paymentTerms} = 'cash' then 0::numeric - ${paymentsOfPurchase()}
    else ${purchase.totalMinorUnits} - ${paymentsOfPurchase()}
  end`;
}

export function createPurchaseQueries(db: Database): PurchaseQueries {
  return {
    async listPurchases(actor, rawQuery) {
      const query = parseInput(
        listPurchasesQuerySchema,
        rawQuery,
        "Purchase list filters are invalid",
      );
      const filterFingerprint = await listFilterFingerprint("purchases", {
        payable: query.payable,
        status: query.status,
        supplierId: query.supplierId ?? null,
      });
      const cursor = decodeOccurrenceCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["purchases:read"]);
        const rows = await tx
          .select({
            ...getTableColumns(purchase),
            createdAtExact: exactCursorTimestamp(purchase.createdAt),
            localDate: businessLocalDateSql(access.timeZone),
            occurredAtExact: exactCursorTimestamp(purchase.occurredAt),
            paymentsMinorUnits: sql<string>`${paymentsOfPurchase()}::text`,
          })
          .from(purchase)
          .where(
            and(
              eq(purchase.businessId, access.businessId),
              query.supplierId ? eq(purchase.supplierId, query.supplierId) : undefined,
              query.status === "all" ? undefined : eq(purchase.status, query.status),
              query.payable === "open"
                ? sql`${balanceOfPurchase()} > 0`
                : query.payable === "paid"
                  ? sql`${balanceOfPurchase()} = 0`
                  : undefined,
              occurrenceKeysetBefore(purchase, cursor),
            ),
          )
          .orderBy(desc(purchase.occurredAt), desc(purchase.createdAt), desc(purchase.id))
          .limit(query.limit + 1);
        const page = pageOccurrenceRows(rows, query.limit, filterFingerprint);
        const [lines, names] = await Promise.all([
          loadLines(
            tx,
            access.businessId,
            page.rows.map(({ id }) => id),
          ),
          loadSupplierNames(
            tx,
            access.businessId,
            page.rows.map(({ supplierId }) => supplierId),
          ),
        ]);
        return {
          items: page.rows.map((row) => {
            const supplierName = names.get(row.supplierId);
            if (!supplierName) throw new Error("Purchase supplier is missing");
            return toPurchase(row, {
              lines: lines.get(row.id) ?? [],
              localDate: row.localDate,
              paymentsMinorUnits: BigInt(row.paymentsMinorUnits),
              supplierName,
            });
          }),
          nextCursor: page.nextCursor,
          queriedAt: access.queriedAt.toISOString(),
        };
      });
    },

    async getPurchase(actor, purchaseId) {
      return db.transaction(
        async (tx) => {
          const access = await authorizeBusinessAction(tx, actor, ["purchases:read"], "none");
          const record = await loadPurchase(tx, access, purchaseId, false);
          const payments = await tx
            .select()
            .from(supplierPayment)
            .where(
              and(
                eq(supplierPayment.businessId, access.businessId),
                eq(supplierPayment.purchaseId, purchaseId),
              ),
            )
            .orderBy(
              desc(supplierPayment.occurredAt),
              desc(supplierPayment.createdAt),
              desc(supplierPayment.id),
            );
          return {
            purchase: await currentPurchase(tx, access, record),
            payments: payments.map(toSupplierPayment),
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },

    async getPayablesSummary(actor) {
      return db.transaction(
        async (tx) => {
          const access = await authorizeBusinessAction(tx, actor, ["purchases:read"], "none");
          const today = businessLocalDateSql(access.timeZone);
          type SummaryRow = {
            business_local_date: string;
            due_soon: string;
            invalid_count: string;
            open_count: string;
            outstanding: string;
            overdue: string;
          };
          const [row] = await tx.execute<SummaryRow>(sql`
            with payment_totals as (${supplierPaymentTotals(access.businessId)}),
            balances as (
              select ${purchaseBalance()} as balance, ${purchase.dueDate} as due_date
              from ${purchase}
              left join payment_totals on payment_totals.purchase_id = ${purchase.id}
              where ${purchase.businessId} = ${access.businessId}
                and ${purchase.status} = 'posted'
            )
            select
              coalesce(sum(balance) filter (where balance > 0), 0::numeric)::text as outstanding,
              coalesce(sum(balance) filter (
                where balance > 0 and due_date >= ${today} and due_date <= ${dueSoonLimitSql(access.timeZone)}
              ), 0::numeric)::text as due_soon,
              coalesce(sum(balance) filter (where balance > 0 and due_date < ${today}), 0::numeric)::text as overdue,
              count(*) filter (where balance > 0)::text as open_count,
              count(*) filter (where balance < 0)::text as invalid_count,
              ${today} as business_local_date
            from balances
          `);
          if (!row) throw new Error("Payables summary query returned no row");
          if (row.invalid_count !== "0") {
            throw new Error("Purchase balance invariant is invalid");
          }
          type NextDueRow = {
            balance: string;
            due_date: string;
            purchase_id: string;
            supplier_name: string;
          };
          const [next] = await tx.execute<NextDueRow>(sql`
            with payment_totals as (${supplierPaymentTotals(access.businessId)})
            select
              ${purchase.id} as purchase_id,
              ${supplier.name} as supplier_name,
              ${purchase.dueDate} as due_date,
              (${purchaseBalance()})::text as balance
            from ${purchase}
            inner join ${supplier}
              on ${supplier.businessId} = ${purchase.businessId}
              and ${supplier.id} = ${purchase.supplierId}
            left join payment_totals on payment_totals.purchase_id = ${purchase.id}
            where ${purchase.businessId} = ${access.businessId}
              and ${purchase.status} = 'posted'
              and ${purchaseBalance()} > 0
              and ${purchase.dueDate} >= ${today}
            order by ${purchase.dueDate} asc, ${purchase.occurredAt} asc, ${purchase.id} asc
            limit 1
          `);
          return {
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            outstandingMinorUnits: row.outstanding,
            dueSoonMinorUnits: row.due_soon,
            overdueMinorUnits: row.overdue,
            openPurchaseCount: row.open_count,
            nextDue: next
              ? {
                  purchaseId: next.purchase_id,
                  supplierName: next.supplier_name,
                  dueDate: next.due_date,
                  balanceMinorUnits: next.balance,
                }
              : null,
            businessLocalDate: row.business_local_date,
            queriedAt: access.queriedAt.toISOString(),
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
