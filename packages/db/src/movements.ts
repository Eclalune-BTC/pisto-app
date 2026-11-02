import {
  type BusinessPermission,
  type MovementKind,
  type MovementList,
  type MovementListQuery,
  movementListQuerySchema,
  movementListSchema,
} from "@pisto/contracts";
import { type SQL, sql } from "drizzle-orm";

import { authorizeBusinessAction, type ProductActor } from "./business-access.ts";
import type { Database } from "./client.ts";
import { ProductError, parseInput } from "./errors.ts";
import {
  decodeOccurrenceCursor,
  listFilterFingerprint,
  type OccurrenceCursor,
  pageOccurrenceRows,
} from "./pagination.ts";
import { hasBusinessPermission } from "./product-access.ts";
import { REPORT_TRANSACTION_CONFIG } from "./reports.ts";
import { expense } from "./schema/cash.ts";
import { cashAccount } from "./schema/cash-account.ts";
import { purchase, purchaseLine, supplier, supplierPayment } from "./schema/purchases.ts";
import { customer, receivable, receivablePayment } from "./schema/receivables.ts";
import { saleLine } from "./schema/sale-line.ts";
import { sale } from "./schema/sales.ts";

export interface MovementsRepository {
  listMovements(actor: ProductActor, query: MovementListQuery): Promise<MovementList>;
}

/**
 * One ledger source. Its SELECT returns, in this order: kind, record_id, parent_record_id,
 * occurred_at, created_at, occurred_local_date, occurred_local_time, amount (signed: money in is
 * positive), account_id, account_name, entry_source, description, counterparty_name,
 * expense_category, reference, line_count, total_minor_units, each aliased because any source can
 * open the union. Only posted records that still stand belong in the ledger, and each row carries
 * the money that actually moved: a sale on credit counts what was received and a purchase on credit
 * counts nothing until its supplier payments.
 */
export type MovementSource = {
  kind: MovementKind;
  permission: BusinessPermission;
  select: (businessId: string) => SQL;
};

export const movementSources: readonly MovementSource[] = [
  {
    kind: "sale",
    permission: "sales:read",
    select: (businessId) => sql`
      select
        'sale'::text as kind,
        ${sale.id} as record_id,
        null::uuid as parent_record_id,
        ${sale.occurredAt} as occurred_at,
        ${sale.createdAt} as created_at,
        ${sale.occurredLocalDate} as occurred_local_date,
        ${sale.occurredLocalTime} as occurred_local_time,
        (case when ${sale.entryMode} = 'itemized'
          then ${sale.receivedMinorUnits} else ${sale.grossMinorUnits} end)::numeric as amount,
        ${sale.cashAccountId} as account_id,
        ${cashAccount.name} as account_name,
        ${sale.entrySource} as entry_source,
        ${sale.description} as description,
        ${customer.name} as counterparty_name,
        null::text as expense_category,
        null::text as reference,
        (case when ${sale.entryMode} = 'itemized' then (
          select count(*) from ${saleLine}
          where ${saleLine.businessId} = ${sale.businessId} and ${saleLine.saleId} = ${sale.id}
        ) end) as line_count,
        (case when ${sale.creditMinorUnits} > 0
          then ${sale.grossMinorUnits} end)::numeric as total_minor_units
      from ${sale}
      left join ${cashAccount}
        on ${cashAccount.businessId} = ${sale.businessId}
        and ${cashAccount.id} = ${sale.cashAccountId}
      left join ${customer}
        on ${customer.businessId} = ${sale.businessId}
        and ${customer.id} = ${sale.customerId}
      where ${sale.businessId} = ${businessId}
        and ${sale.status} = 'posted'`,
  },
  {
    kind: "expense",
    permission: "expenses:read",
    select: (businessId) => sql`
      select
        'expense'::text as kind,
        ${expense.id} as record_id,
        null::uuid as parent_record_id,
        ${expense.occurredAt} as occurred_at,
        ${expense.createdAt} as created_at,
        ${expense.occurredLocalDate} as occurred_local_date,
        ${expense.occurredLocalTime} as occurred_local_time,
        -${expense.amountMinorUnits}::numeric as amount,
        ${expense.accountId} as account_id,
        ${cashAccount.name} as account_name,
        ${expense.entrySource} as entry_source,
        ${expense.description} as description,
        ${expense.payee} as counterparty_name,
        ${expense.category} as expense_category,
        null::text as reference,
        null::bigint as line_count,
        null::numeric as total_minor_units
      from ${expense}
      join ${cashAccount}
        on ${cashAccount.businessId} = ${expense.businessId}
        and ${cashAccount.id} = ${expense.accountId}
      where ${expense.businessId} = ${businessId}
        and ${expense.status} = 'posted'`,
  },
  {
    kind: "receivable_payment",
    permission: "receivables:read",
    select: (businessId) => sql`
      select
        'receivable_payment'::text as kind,
        ${receivablePayment.id} as record_id,
        ${receivablePayment.receivableId} as parent_record_id,
        ${receivablePayment.occurredAt} as occurred_at,
        ${receivablePayment.createdAt} as created_at,
        ${receivablePayment.occurredLocalDate} as occurred_local_date,
        ${receivablePayment.occurredLocalTime} as occurred_local_time,
        ${receivablePayment.amountMinorUnits}::numeric as amount,
        ${receivablePayment.cashAccountId} as account_id,
        ${cashAccount.name} as account_name,
        ${receivablePayment.entrySource} as entry_source,
        ${receivable.description} as description,
        ${customer.name} as counterparty_name,
        null::text as expense_category,
        ${receivablePayment.reference} as reference,
        null::bigint as line_count,
        null::numeric as total_minor_units
      from ${receivablePayment}
      join ${receivable}
        on ${receivable.businessId} = ${receivablePayment.businessId}
        and ${receivable.id} = ${receivablePayment.receivableId}
      join ${customer}
        on ${customer.businessId} = ${receivablePayment.businessId}
        and ${customer.id} = ${receivablePayment.customerId}
      join ${cashAccount}
        on ${cashAccount.businessId} = ${receivablePayment.businessId}
        and ${cashAccount.id} = ${receivablePayment.cashAccountId}
      where ${receivablePayment.businessId} = ${businessId}
        and ${receivablePayment.kind} = 'payment'
        and not exists (
          select 1 from ${receivablePayment} as reversal
          where reversal.business_id = ${receivablePayment.businessId}
            and reversal.reverses_payment_id = ${receivablePayment.id}
        )`,
  },
  {
    kind: "purchase",
    permission: "purchases:read",
    select: (businessId) => sql`
      select
        'purchase'::text as kind,
        ${purchase.id} as record_id,
        null::uuid as parent_record_id,
        ${purchase.occurredAt} as occurred_at,
        ${purchase.createdAt} as created_at,
        ${purchase.occurredLocalDate} as occurred_local_date,
        ${purchase.occurredLocalTime} as occurred_local_time,
        (case when ${purchase.paymentTerms} = 'cash'
          then -${purchase.totalMinorUnits} else 0 end)::numeric as amount,
        ${purchase.cashAccountId} as account_id,
        ${cashAccount.name} as account_name,
        ${purchase.entrySource} as entry_source,
        ${purchase.note} as description,
        ${supplier.name} as counterparty_name,
        null::text as expense_category,
        ${purchase.invoiceNumber} as reference,
        (
          select count(*) from ${purchaseLine}
          where ${purchaseLine.businessId} = ${purchase.businessId}
            and ${purchaseLine.purchaseId} = ${purchase.id}
        ) as line_count,
        (case when ${purchase.paymentTerms} = 'credit'
          then ${purchase.totalMinorUnits} end)::numeric as total_minor_units
      from ${purchase}
      join ${supplier}
        on ${supplier.businessId} = ${purchase.businessId}
        and ${supplier.id} = ${purchase.supplierId}
      left join ${cashAccount}
        on ${cashAccount.businessId} = ${purchase.businessId}
        and ${cashAccount.id} = ${purchase.cashAccountId}
      where ${purchase.businessId} = ${businessId}
        and ${purchase.status} = 'posted'`,
  },
  {
    kind: "supplier_payment",
    permission: "purchases:read",
    select: (businessId) => sql`
      select
        'supplier_payment'::text as kind,
        ${supplierPayment.id} as record_id,
        ${supplierPayment.purchaseId} as parent_record_id,
        ${supplierPayment.occurredAt} as occurred_at,
        ${supplierPayment.createdAt} as created_at,
        ${supplierPayment.occurredLocalDate} as occurred_local_date,
        ${supplierPayment.occurredLocalTime} as occurred_local_time,
        -${supplierPayment.amountMinorUnits}::numeric as amount,
        ${supplierPayment.cashAccountId} as account_id,
        ${cashAccount.name} as account_name,
        ${supplierPayment.entrySource} as entry_source,
        null::text as description,
        ${supplier.name} as counterparty_name,
        null::text as expense_category,
        coalesce(${supplierPayment.reference}, ${purchase.invoiceNumber}) as reference,
        null::bigint as line_count,
        null::numeric as total_minor_units
      from ${supplierPayment}
      join ${purchase}
        on ${purchase.businessId} = ${supplierPayment.businessId}
        and ${purchase.id} = ${supplierPayment.purchaseId}
      join ${supplier}
        on ${supplier.businessId} = ${supplierPayment.businessId}
        and ${supplier.id} = ${supplierPayment.supplierId}
      join ${cashAccount}
        on ${cashAccount.businessId} = ${supplierPayment.businessId}
        and ${cashAccount.id} = ${supplierPayment.cashAccountId}
      where ${supplierPayment.businessId} = ${businessId}
        and ${purchase.status} = 'posted'`,
  },
];

type MovementRow = {
  account_id: string | null;
  account_name: string | null;
  amount: string;
  counterparty_name: string | null;
  created_at_exact: string;
  description: string | null;
  entry_source: string;
  expense_category: string | null;
  kind: string;
  line_count: string | null;
  occurred_at: Date | string;
  occurred_at_exact: string;
  occurred_local_date: string;
  occurred_local_time: string;
  parent_record_id: string | null;
  record_id: string;
  reference: string | null;
  total_minor_units: string | null;
};

type TotalsRow = { inflow: string; net: string; outflow: string };

function likePattern(search: string) {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
}

function cursorCondition(cursor: OccurrenceCursor | null): SQL | undefined {
  if (!cursor) return undefined;
  return sql`(ledger.occurred_at, ledger.created_at, ledger.record_id) < (${cursor.occurredAt}::timestamptz, ${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}

const totalsColumns = sql`
  coalesce(sum(ledger.amount) filter (where ledger.amount > 0), 0::numeric)::text as inflow,
  coalesce(-sum(ledger.amount) filter (where ledger.amount < 0), 0::numeric)::text as outflow,
  coalesce(sum(ledger.amount), 0::numeric)::text as net`;

export function createMovementsRepository(
  db: Database,
  sources: readonly MovementSource[] = movementSources,
): MovementsRepository {
  return {
    async listMovements(actor, rawQuery) {
      const query = parseInput(movementListQuerySchema, rawQuery, "Movement list query is invalid");
      const filterFingerprint = await listFilterFingerprint("movements", {
        accountId: query.accountId ?? null,
        endLocalDate: query.endLocalDate,
        movementKind: query.kind,
        query: query.query ?? null,
        startLocalDate: query.startLocalDate,
      });
      const cursor = decodeOccurrenceCursor(query.cursor, filterFingerprint);

      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["cash:read"], "none");
        // A local midnight can fall in a daylight-saving gap, which only the zone's own rules resolve.
        type BoundsRow = { end_utc_exclusive: Date | string; start_utc: Date | string };
        const [bounds] = await tx.execute<BoundsRow>(sql`
          select
            (${query.startLocalDate}::date::timestamp at time zone ${access.timeZone}) as start_utc,
            ((${query.endLocalDate}::date + 1)::timestamp at time zone ${access.timeZone}) as end_utc_exclusive
        `);
        if (!bounds) throw new Error("Movement period bounds query returned no row");
        const startUtc = new Date(bounds.start_utc).toISOString();
        const endUtcExclusive = new Date(bounds.end_utc_exclusive).toISOString();
        if (query.kind !== "all") {
          const requested = sources.find((source) => source.kind === query.kind);
          if (!requested) {
            throw new ProductError("VALIDATION_ERROR", "This movement kind is not available");
          }
          if (!hasBusinessPermission(access.role, requested.permission)) {
            throw new ProductError("FORBIDDEN", "This movement kind cannot be read");
          }
        }
        const readable = sources.filter(
          (source) =>
            (query.kind === "all" || query.kind === source.kind) &&
            hasBusinessPermission(access.role, source.permission),
        );
        const base = {
          currency: access.currency,
          currencyMinorUnitDigits: access.currencyMinorUnitDigits,
          period: {
            startLocalDate: query.startLocalDate,
            endLocalDate: query.endLocalDate,
            timeZone: access.timeZone,
          },
          queriedAt: access.queriedAt.toISOString(),
        };
        if (readable.length === 0) {
          return movementListSchema.parse({
            ...base,
            items: [],
            nextCursor: null,
            totals: { inflowMinorUnits: "0", outflowMinorUnits: "0", netMinorUnits: "0" },
            days: [],
          });
        }

        const ledger = sql.join(
          readable.map((source) => sql`(${source.select(access.businessId)})`),
          sql` union all `,
        );
        const search = query.query ? likePattern(query.query) : undefined;
        const filters = sql.join(
          [
            sql`ledger.occurred_at >= ${startUtc}::timestamptz`,
            sql`ledger.occurred_at < ${endUtcExclusive}::timestamptz`,
            query.accountId ? sql`ledger.account_id = ${query.accountId}::uuid` : undefined,
            search
              ? sql`(
                  ledger.description ilike ${search} escape '\\'
                  or ledger.counterparty_name ilike ${search} escape '\\'
                  or ledger.reference ilike ${search} escape '\\'
                  or ledger.account_name ilike ${search} escape '\\'
                )`
              : undefined,
          ].filter((condition): condition is SQL => condition !== undefined),
          sql` and `,
        );

        const rows = await tx.execute<MovementRow>(sql`
          select
            ledger.kind,
            ledger.record_id,
            ledger.parent_record_id,
            ledger.occurred_at,
            ledger.occurred_local_date,
            ledger.occurred_local_time,
            ledger.account_id,
            ledger.account_name,
            ledger.entry_source,
            ledger.description,
            ledger.counterparty_name,
            ledger.expense_category,
            ledger.reference,
            to_char(ledger.occurred_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00' as occurred_at_exact,
            to_char(ledger.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00' as created_at_exact,
            ledger.amount::text as amount,
            ledger.line_count::text as line_count,
            ledger.total_minor_units::text as total_minor_units
          from (${ledger}) as ledger
          where ${filters}
            ${cursor ? sql`and ${cursorCondition(cursor)}` : sql``}
          order by ledger.occurred_at desc, ledger.created_at desc, ledger.record_id desc
          limit ${query.limit + 1}
        `);
        const page = pageOccurrenceRows(
          rows.map((row) => ({
            ...row,
            id: row.record_id,
            occurredAtExact: row.occurred_at_exact,
            createdAtExact: row.created_at_exact,
          })),
          query.limit,
          filterFingerprint,
        );

        const [totals] = await tx.execute<TotalsRow>(sql`
          select ${totalsColumns}
          from (${ledger}) as ledger
          where ${filters}
        `);
        if (!totals) throw new Error("Movement totals query returned no row");

        const pageDates = [...new Set(page.rows.map((row) => row.occurred_local_date))];
        const days =
          pageDates.length === 0
            ? []
            : await tx.execute<TotalsRow & { local_date: string }>(sql`
                select ledger.occurred_local_date as local_date, ${totalsColumns}
                from (${ledger}) as ledger
                where ${filters}
                  and ledger.occurred_local_date in (${sql.join(
                    pageDates.map((date) => sql`${date}`),
                    sql`, `,
                  )})
                group by ledger.occurred_local_date
                order by ledger.occurred_local_date desc
              `);

        return movementListSchema.parse({
          ...base,
          items: page.rows.map((row) => ({
            kind: row.kind,
            recordId: row.record_id,
            parentRecordId: row.parent_record_id,
            occurredAt: new Date(row.occurred_at).toISOString(),
            occurredLocalDate: row.occurred_local_date,
            occurredLocalTime: row.occurred_local_time,
            amountMinorUnits: row.amount,
            accountId: row.account_id,
            accountName: row.account_name,
            entrySource: row.entry_source,
            facts: {
              description: row.description,
              counterpartyName: row.counterparty_name,
              expenseCategory: row.expense_category,
              reference: row.reference,
              lineCount: row.line_count,
              totalMinorUnits: row.total_minor_units,
            },
          })),
          nextCursor: page.nextCursor,
          totals: {
            inflowMinorUnits: totals.inflow,
            outflowMinorUnits: totals.outflow,
            netMinorUnits: totals.net,
          },
          days: days.map((row) => ({
            localDate: row.local_date,
            inflowMinorUnits: row.inflow,
            outflowMinorUnits: row.outflow,
            netMinorUnits: row.net,
          })),
        });
      }, REPORT_TRANSACTION_CONFIG);
    },
  };
}
