import { listSuppliersQuerySchema } from "@pisto/contracts";
import { and, eq, type SQL, sql } from "drizzle-orm";

import { type AuthorizedBusinessContext, authorizeBusinessAction } from "../business-access.ts";
import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import {
  decodeCursor,
  exactCursorTimestamp,
  keysetBefore,
  listFilterFingerprint,
  pageRows,
} from "../pagination.ts";
import { purchase, supplier } from "../schema/purchases.ts";
import { containsText } from "../text-search.ts";
import { toSupplier } from "./mappers.ts";
import { businessLocalDateSql, purchaseBalance, supplierPaymentTotals } from "./records.ts";
import type { PurchasesRepository } from "./types.ts";

type SupplierQueries = Pick<PurchasesRepository, "getSupplier" | "listSuppliers">;

type SupplierRow = {
  contact_name: string | null;
  created_at: Date | string;
  createdAtExact: string;
  credit_days: number | null;
  email: string | null;
  id: string;
  last_purchase: string | null;
  name: string;
  notes: string | null;
  open_count: string;
  outstanding: string;
  overdue: string;
  phone: string | null;
  status: string;
  tax_id: string | null;
  updated_at: Date | string;
};

/** Per-supplier balances over every purchase of the business, keyed by `supplier_id`. */
function supplierBalances(businessId: string, timeZone: string): SQL {
  const balance = purchaseBalance();
  return sql`
    with payment_totals as (${supplierPaymentTotals(businessId)})
    select
      ${purchase.supplierId} as supplier_id,
      coalesce(sum(${balance}) filter (where ${balance} > 0), 0::numeric) as outstanding,
      coalesce(sum(${balance}) filter (
        where ${balance} > 0 and ${purchase.dueDate} < ${businessLocalDateSql(timeZone)}
      ), 0::numeric) as overdue,
      count(*) filter (where ${balance} > 0) as open_count,
      max(${purchase.occurredLocalDate}) filter (where ${purchase.status} = 'posted') as last_purchase
    from ${purchase}
    left join payment_totals on payment_totals.purchase_id = ${purchase.id}
    where ${purchase.businessId} = ${businessId}
    group by ${purchase.supplierId}`;
}

function supplierRows(access: AuthorizedBusinessContext, where: SQL | undefined, tail: SQL): SQL {
  return sql`
    with balances as (${supplierBalances(access.businessId, access.timeZone)})
    select
      ${supplier.id} as id,
      ${supplier.name} as name,
      ${supplier.contactName} as contact_name,
      ${supplier.phone} as phone,
      ${supplier.email} as email,
      ${supplier.taxId} as tax_id,
      ${supplier.creditDays} as credit_days,
      ${supplier.notes} as notes,
      ${supplier.status} as status,
      ${supplier.createdAt} as created_at,
      ${exactCursorTimestamp(supplier.createdAt)} as "createdAtExact",
      ${supplier.updatedAt} as updated_at,
      coalesce(balances.outstanding, 0::numeric)::text as outstanding,
      coalesce(balances.overdue, 0::numeric)::text as overdue,
      coalesce(balances.open_count, 0)::text as open_count,
      balances.last_purchase as last_purchase
    from ${supplier}
    left join balances on balances.supplier_id = ${supplier.id}
    where ${where}
    ${tail}`;
}

function toListItem(access: AuthorizedBusinessContext, row: SupplierRow) {
  return {
    ...toSupplier({
      id: row.id,
      businessId: access.businessId,
      name: row.name,
      contactName: row.contact_name,
      phone: row.phone,
      email: row.email,
      taxId: row.tax_id,
      creditDays: row.credit_days,
      notes: row.notes,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }),
    balance: {
      currency: access.currency,
      currencyMinorUnitDigits: access.currencyMinorUnitDigits,
      outstandingMinorUnits: row.outstanding,
      overdueMinorUnits: row.overdue,
      openPurchaseCount: row.open_count,
      lastPurchaseLocalDate: row.last_purchase,
      queriedAt: access.queriedAt.toISOString(),
    },
  };
}

export function createSupplierQueries(db: Database): SupplierQueries {
  return {
    async listSuppliers(actor, rawQuery) {
      const query = parseInput(
        listSuppliersQuerySchema,
        rawQuery,
        "Supplier list filters are invalid",
      );
      const filterFingerprint = await listFilterFingerprint("suppliers", {
        balance: query.balance,
        query: query.query ?? null,
        status: query.status,
      });
      const cursor = decodeCursor(query.cursor, filterFingerprint);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["purchases:read"]);
        const rows = await tx.execute<SupplierRow>(
          supplierRows(
            access,
            and(
              eq(supplier.businessId, access.businessId),
              query.status === "all" ? undefined : eq(supplier.status, query.status),
              query.query
                ? containsText(
                    [
                      supplier.name,
                      supplier.contactName,
                      supplier.phone,
                      supplier.email,
                      supplier.taxId,
                    ],
                    query.query,
                  )
                : undefined,
              query.balance === "outstanding"
                ? sql`coalesce(balances.outstanding, 0::numeric) > 0`
                : undefined,
              keysetBefore(supplier, cursor),
            ),
            sql`order by ${supplier.createdAt} desc, ${supplier.id} desc limit ${query.limit + 1}`,
          ),
        );
        const page = pageRows(rows, query.limit, filterFingerprint);
        return {
          items: page.rows.map((row) => toListItem(access, row)),
          nextCursor: page.nextCursor,
          queriedAt: access.queriedAt.toISOString(),
        };
      });
    },

    async getSupplier(actor, supplierId) {
      return db.transaction(
        async (tx) => {
          const access = await authorizeBusinessAction(tx, actor, ["purchases:read"], "none");
          const [row] = await tx.execute<SupplierRow>(
            supplierRows(
              access,
              and(eq(supplier.businessId, access.businessId), eq(supplier.id, supplierId)),
              sql`limit 1`,
            ),
          );
          if (!row) throw new ProductError("NOT_FOUND", "Supplier was not found");
          const { balance, ...record } = toListItem(access, row);
          return { supplier: record, balance };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
