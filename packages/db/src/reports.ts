import {
  type OperatingReport,
  type OperatingReportQuery,
  operatingReportQuerySchema,
  operatingReportSchema,
  reportCashAccountFactsSchema,
  reportExpenseCategoryFactsSchema,
} from "@pisto/contracts";
import { sql } from "drizzle-orm";

import {
  type AuthorizedBusinessContext,
  authorizeBusinessAction,
  type DatabaseTransaction,
} from "./business-access.ts";
import type { Database } from "./client.ts";
import { type ProductActor, ProductError } from "./product-core.ts";
import { cashMovement, expense } from "./schema/cash.ts";
import { cashAccount } from "./schema/cash-account.ts";
import { catalogProduct, inventoryMovement } from "./schema/catalog.ts";
import { receivable, receivablePayment } from "./schema/receivables.ts";
import { sale } from "./schema/sales.ts";

export const REPORT_TRANSACTION_CONFIG = {
  accessMode: "read only",
  isolationLevel: "repeatable read",
} as const;

export interface ReportsRepository {
  getOperatingReport(actor: ProductActor, query: OperatingReportQuery): Promise<OperatingReport>;
}

// The bounds stay ISO strings because postgres.js binds a JavaScript Date in a
// raw `sql` fragment as text and rejects it; every use casts to timestamptz.
type ReportBounds = {
  endUtcExclusive: string;
  positionAsOfLocalDate: string;
  startUtc: string;
};

async function resolveReportBounds(
  transaction: DatabaseTransaction,
  query: OperatingReportQuery,
  access: AuthorizedBusinessContext,
): Promise<ReportBounds> {
  type BoundsRow = {
    end_utc_exclusive: Date | string;
    isolation_level: string;
    position_as_of_local_date: string;
    start_utc: Date | string;
  };
  // A local midnight can fall in a daylight-saving gap, which only the zone's
  // own rules resolve.
  const [row] = await transaction.execute<BoundsRow>(sql`
    select
      (${query.startLocalDate}::date::timestamp at time zone ${access.timeZone}) as start_utc,
      (((${query.endLocalDate}::date + 1)::timestamp) at time zone ${access.timeZone}) as end_utc_exclusive,
      to_char(transaction_timestamp() at time zone ${access.timeZone}, 'YYYY-MM-DD') as position_as_of_local_date,
      current_setting('transaction_isolation') as isolation_level
  `);
  if (!row) throw new Error("Operating report bounds query returned no row");
  if (row.isolation_level !== REPORT_TRANSACTION_CONFIG.isolationLevel) {
    throw new Error("Operating reports require a repeatable-read transaction");
  }
  return {
    startUtc: new Date(row.start_utc).toISOString(),
    endUtcExclusive: new Date(row.end_utc_exclusive).toISOString(),
    positionAsOfLocalDate: row.position_as_of_local_date,
  };
}

function sumIntegerStrings(values: readonly string[]): string {
  return values.reduce((total, value) => total + BigInt(value), 0n).toString();
}

export function createReportsRepository(db: Database): ReportsRepository {
  return {
    async getOperatingReport(actor, rawQuery) {
      const parsedQuery = operatingReportQuerySchema.safeParse(rawQuery);
      if (!parsedQuery.success) {
        throw new ProductError("VALIDATION_ERROR", "The operating report range is invalid");
      }
      const query = parsedQuery.data;

      return db.transaction(async (transaction) => {
        const access = await authorizeBusinessAction(transaction, actor, ["reports:read"], "none");
        const bounds = await resolveReportBounds(transaction, query, access);

        type SalesRow = { gross_minor_units: string; sale_count: string };
        const [salesRow] = await transaction.execute<SalesRow>(sql`
          select
            coalesce(sum(${sale.grossMinorUnits}), 0::numeric)::text as gross_minor_units,
            count(*)::text as sale_count
          from ${sale}
          where ${sale.businessId} = ${access.businessId}
            and ${sale.status} = 'posted'
            and ${sale.occurredAt} >= ${bounds.startUtc}::timestamptz
            and ${sale.occurredAt} < ${bounds.endUtcExclusive}::timestamptz
        `);
        if (!salesRow) throw new Error("Operating report sales query returned no row");

        type ExpenseRow = {
          category: string;
          expense_count: string;
          total_minor_units: string;
        };
        const expenseRows = await transaction.execute<ExpenseRow>(sql`
          select
            ${expense.category} as category,
            sum(${expense.amountMinorUnits})::text as total_minor_units,
            count(*)::text as expense_count
          from ${expense}
          where ${expense.businessId} = ${access.businessId}
            and ${expense.status} = 'posted'
            and ${expense.occurredAt} >= ${bounds.startUtc}::timestamptz
            and ${expense.occurredAt} < ${bounds.endUtcExclusive}::timestamptz
          group by ${expense.category}
          order by array_position(
            array['inventory', 'rent', 'utilities', 'payroll', 'transport', 'marketing', 'tax', 'other']::text[],
            ${expense.category}
          )
        `);
        const expenseCategories = expenseRows.map((row) =>
          reportExpenseCategoryFactsSchema.parse({
            category: row.category,
            totalMinorUnits: row.total_minor_units,
            expenseCount: row.expense_count,
          }),
        );

        // A transfer moves money between two accounts of one business, so its pair
        // of legs is account movement but not business inflow or outflow.
        type CashAccountRow = {
          account_id: string;
          account_kind: string;
          account_name: string;
          account_status: string;
          external_inflow_minor_units: string;
          external_outflow_minor_units: string;
          inflow_minor_units: string;
          net_movement_minor_units: string;
          outflow_minor_units: string;
        };
        const cashAccountRows = await transaction.execute<CashAccountRow>(sql`
          select
            ${cashAccount.id}::text as account_id,
            ${cashAccount.name} as account_name,
            ${cashAccount.kind} as account_kind,
            ${cashAccount.status} as account_status,
            coalesce(sum(${cashMovement.amountMinorUnits}) filter (
              where ${cashMovement.direction} = 'in'
            ), 0::numeric)::text as inflow_minor_units,
            coalesce(sum(${cashMovement.amountMinorUnits}) filter (
              where ${cashMovement.direction} = 'out'
            ), 0::numeric)::text as outflow_minor_units,
            coalesce(sum(${cashMovement.amountMinorUnits}) filter (
              where ${cashMovement.direction} = 'in'
                and ${cashMovement.action} not in ('transfer_in', 'transfer_out')
            ), 0::numeric)::text as external_inflow_minor_units,
            coalesce(sum(${cashMovement.amountMinorUnits}) filter (
              where ${cashMovement.direction} = 'out'
                and ${cashMovement.action} not in ('transfer_in', 'transfer_out')
            ), 0::numeric)::text as external_outflow_minor_units,
            coalesce(sum(${cashMovement.deltaMinorUnits}), 0::numeric)::text as net_movement_minor_units
          from ${cashAccount}
          left join ${cashMovement}
            on ${cashMovement.businessId} = ${cashAccount.businessId}
            and ${cashMovement.accountId} = ${cashAccount.id}
            and ${cashMovement.occurredAt} >= ${bounds.startUtc}::timestamptz
            and ${cashMovement.occurredAt} < ${bounds.endUtcExclusive}::timestamptz
          where ${cashAccount.businessId} = ${access.businessId}
          group by
            ${cashAccount.id},
            ${cashAccount.name},
            ${cashAccount.kind},
            ${cashAccount.status}
          order by
            case when ${cashAccount.status} = 'active' then 0 else 1 end,
            lower(${cashAccount.name}),
            ${cashAccount.id}
        `);
        const cashAccounts = cashAccountRows.map((row) =>
          reportCashAccountFactsSchema.parse({
            accountId: row.account_id,
            accountName: row.account_name,
            accountKind: row.account_kind,
            accountStatus: row.account_status,
            inflowMinorUnits: row.inflow_minor_units,
            outflowMinorUnits: row.outflow_minor_units,
            netMovementMinorUnits: row.net_movement_minor_units,
          }),
        );

        type InventoryRow = {
          low_stock_product_count: string;
          tracked_product_count: string;
        };
        const [inventoryRow] = await transaction.execute<InventoryRow>(sql`
          with balances as (
            select
              ${inventoryMovement.productId} as product_id,
              sum(${inventoryMovement.deltaMinorUnits}) as on_hand
            from ${inventoryMovement}
            where ${inventoryMovement.businessId} = ${access.businessId}
            group by ${inventoryMovement.productId}
          )
          select
            count(*)::text as tracked_product_count,
            count(*) filter (
              where ${catalogProduct.lowStockThresholdMinorUnits} is not null
                and coalesce(balances.on_hand, 0::numeric) <= ${catalogProduct.lowStockThresholdMinorUnits}
            )::text as low_stock_product_count
          from ${catalogProduct}
          left join balances on balances.product_id = ${catalogProduct.id}
          where ${catalogProduct.businessId} = ${access.businessId}
            and ${catalogProduct.status} = 'active'
            and ${catalogProduct.tracked} = true
        `);
        if (!inventoryRow) throw new Error("Operating report inventory query returned no row");

        type ReceivableRow = {
          invalid_balance_count: string;
          open_receivable_count: string;
          outstanding_minor_units: string;
          overdue_minor_units: string;
          overdue_receivable_count: string;
        };
        const [receivableRow] = await transaction.execute<ReceivableRow>(sql`
          with payment_totals as (
            select
              ${receivablePayment.receivableId} as receivable_id,
              sum(case
                when ${receivablePayment.kind} = 'payment' then ${receivablePayment.amountMinorUnits}
                else -${receivablePayment.amountMinorUnits}
              end) as paid
            from ${receivablePayment}
            where ${receivablePayment.businessId} = ${access.businessId}
            group by ${receivablePayment.receivableId}
          ), balances as (
            select
              (${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric)) as outstanding,
              ${receivable.dueDate} is not null
                and ${receivable.dueDate} < ${bounds.positionAsOfLocalDate} as overdue
            from ${receivable}
            left join payment_totals on payment_totals.receivable_id = ${receivable.id}
            where ${receivable.businessId} = ${access.businessId}
              and ${receivable.status} = 'posted'
          )
          select
            coalesce(sum(outstanding), 0::numeric)::text as outstanding_minor_units,
            coalesce(sum(case when overdue and outstanding > 0 then outstanding else 0 end), 0::numeric)::text as overdue_minor_units,
            count(*) filter (where outstanding > 0)::text as open_receivable_count,
            count(*) filter (where overdue and outstanding > 0)::text as overdue_receivable_count,
            count(*) filter (where outstanding < 0)::text as invalid_balance_count
          from balances
        `);
        if (!receivableRow) {
          throw new Error("Operating report receivables query returned no row");
        }
        if (receivableRow.invalid_balance_count !== "0") {
          throw new Error("Receivable outstanding balance invariant is invalid");
        }

        return operatingReportSchema.parse({
          period: {
            startLocalDate: query.startLocalDate,
            endLocalDateInclusive: query.endLocalDate,
            startUtc: bounds.startUtc,
            endUtcExclusive: bounds.endUtcExclusive,
            timeZone: access.timeZone,
          },
          positionAsOfLocalDate: bounds.positionAsOfLocalDate,
          currency: access.currency,
          currencyMinorUnitDigits: access.currencyMinorUnitDigits,
          sales: {
            grossMinorUnits: salesRow.gross_minor_units,
            saleCount: salesRow.sale_count,
          },
          expenses: {
            totalMinorUnits: sumIntegerStrings(
              expenseCategories.map(({ totalMinorUnits }) => totalMinorUnits),
            ),
            expenseCount: sumIntegerStrings(
              expenseCategories.map(({ expenseCount }) => expenseCount),
            ),
            categories: expenseCategories,
          },
          cash: {
            inflowMinorUnits: sumIntegerStrings(
              cashAccountRows.map((row) => row.external_inflow_minor_units),
            ),
            outflowMinorUnits: sumIntegerStrings(
              cashAccountRows.map((row) => row.external_outflow_minor_units),
            ),
            netMovementMinorUnits: sumIntegerStrings(
              cashAccounts.map(({ netMovementMinorUnits }) => netMovementMinorUnits),
            ),
            accounts: cashAccounts,
          },
          inventory: {
            trackedProductCount: inventoryRow.tracked_product_count,
            lowStockProductCount: inventoryRow.low_stock_product_count,
          },
          receivables: {
            outstandingMinorUnits: receivableRow.outstanding_minor_units,
            overdueMinorUnits: receivableRow.overdue_minor_units,
            openReceivableCount: receivableRow.open_receivable_count,
            overdueReceivableCount: receivableRow.overdue_receivable_count,
          },
          queriedAt: access.queriedAt.toISOString(),
        });
      }, REPORT_TRANSACTION_CONFIG);
    },
  };
}
