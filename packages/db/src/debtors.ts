import { type Debtors, debtorsSchema, maximumDebtors } from "@pisto/contracts";
import { sql } from "drizzle-orm";

import { authorizeBusinessAction, type ProductActor } from "./business-access.ts";
import type { Database } from "./client.ts";
import { businessLocalDate, paymentTotals } from "./receivables/records.ts";
import { REPORT_TRANSACTION_CONFIG } from "./reports.ts";
import { customer, receivable } from "./schema/receivables.ts";

export interface DebtorsRepository {
  getDebtors(actor: ProductActor): Promise<Debtors>;
}

export function createDebtorsRepository(db: Database): DebtorsRepository {
  return {
    async getDebtors(actor) {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["receivables:read"], "none");
        const [clock] = await tx.execute<{ local_date: string }>(
          sql`select ${businessLocalDate(access.timeZone)} as local_date`,
        );
        if (!clock) throw new Error("Database clock returned no row");
        const today = clock.local_date;

        type DebtorRow = {
          customer_count: string;
          customer_id: string;
          customer_name: string;
          next_due_local_date: string | null;
          open_receivable_count: string;
          outstanding_minor_units: string;
          overdue_minor_units: string;
          overdue_since_local_date: string | null;
        };
        const rows = await tx.execute<DebtorRow>(sql`
          with payment_totals as (${paymentTotals(access.businessId)}),
          open_balances as (
            select
              ${receivable.customerId} as customer_id,
              ${receivable.dueDate} as due_date,
              ${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric) as outstanding
            from ${receivable}
            left join payment_totals on payment_totals.receivable_id = ${receivable.id}
            where ${receivable.businessId} = ${access.businessId}
              and ${receivable.status} = 'posted'
          ),
          debtors as (
            select
              customer_id,
              sum(outstanding) as outstanding,
              coalesce(sum(outstanding) filter (where due_date < ${today}), 0::numeric) as overdue,
              count(*) as open_count,
              min(due_date) filter (where due_date < ${today}) as overdue_since,
              min(due_date) filter (where due_date >= ${today}) as next_due
            from open_balances
            where outstanding > 0
            group by customer_id
          )
          select
            debtors.customer_id::text as customer_id,
            ${customer.name} as customer_name,
            debtors.outstanding::text as outstanding_minor_units,
            debtors.overdue::text as overdue_minor_units,
            debtors.open_count::text as open_receivable_count,
            debtors.overdue_since as overdue_since_local_date,
            debtors.next_due as next_due_local_date,
            count(*) over ()::text as customer_count
          from debtors
          join ${customer}
            on ${customer.businessId} = ${access.businessId}
            and ${customer.id} = debtors.customer_id
          order by debtors.overdue desc, debtors.outstanding desc, lower(${customer.name}), debtors.customer_id
          limit ${maximumDebtors}
        `);

        return debtorsSchema.parse({
          items: rows.map((row) => ({
            customerId: row.customer_id,
            customerName: row.customer_name,
            outstandingMinorUnits: row.outstanding_minor_units,
            overdueMinorUnits: row.overdue_minor_units,
            openReceivableCount: row.open_receivable_count,
            overdueSinceLocalDate: row.overdue_since_local_date,
            nextDueLocalDate: row.next_due_local_date,
          })),
          customerCount: rows[0]?.customer_count ?? "0",
          businessLocalDate: today,
          currency: access.currency,
          currencyMinorUnitDigits: access.currencyMinorUnitDigits,
          queriedAt: access.queriedAt.toISOString(),
        });
      }, REPORT_TRANSACTION_CONFIG);
    },
  };
}
