import type { BusinessPermission } from "@pisto/contracts";
import { and, asc, desc, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { authorizeBusinessAction, type ProductActor } from "./business-access.ts";
import { onHandQuantity } from "./catalog/records.ts";
import type { Database } from "./client.ts";
import { hasBusinessPermission, resolveBusinessAccess } from "./product-access.ts";
import { purchaseBalance, supplierPaymentTotals } from "./purchases/records.ts";
import { paymentTotals } from "./receivables/records.ts";
import { cashAccount } from "./schema/cash-account.ts";
import { catalogProduct } from "./schema/catalog.ts";
import { purchase, supplier } from "./schema/purchases.ts";
import { customer, receivable } from "./schema/receivables.ts";

export interface AssistantBusinessContext {
  businessId: string;
  currency: string;
  currencyMinorUnitDigits: number;
  timeZone: string;
  /** Business-local calendar date and minute when the lookup ran, from the database clock. */
  localDate: string;
  localTime: string;
  permissions: readonly BusinessPermission[];
}

export interface AssistantDirectoryProduct {
  id: string;
  name: string;
  sellingPriceMinorUnits: string | null;
  quantityPrecision: number;
  tracked: boolean;
  /** Null when the member cannot read inventory or the product is not tracked. */
  onHandMinorUnits: string | null;
}

export interface AssistantDirectoryCustomer {
  id: string;
  name: string;
  /** Null when nothing is owed or the member cannot read receivables. */
  oldestOpenReceivable: { id: string; description: string; balanceMinorUnits: string } | null;
}

export interface AssistantDirectoryAccount {
  id: string;
  name: string;
  kind: "cash" | "bank" | "mobile_money" | "other";
}

export interface AssistantDirectoryLookup {
  context: AssistantBusinessContext;
  products: AssistantDirectoryProduct[];
  customers: AssistantDirectoryCustomer[];
  accounts: AssistantDirectoryAccount[];
}

export interface AssistantDirectoryRepository {
  /** Fails unless the actor may use the assistant in its active business, before any model cost. */
  authorize(actor: ProductActor): Promise<{ businessId: string }>;
  /**
   * Authorizes `assistant:use` and reads, from the active business only, the records whose folded
   * name contains one of the search terms. Each record family is returned only when the member's
   * role can read it.
   */
  lookup(
    actor: ProductActor,
    terms: { products: readonly string[]; customers: readonly string[] },
  ): Promise<AssistantDirectoryLookup>;
}

export interface AssistantDirectorySupplier {
  id: string;
  name: string;
  /** Null when nothing is owed to the supplier. */
  oldestOpenPurchase: {
    id: string;
    invoiceNumber: string | null;
    balanceMinorUnits: string;
  } | null;
}

export interface AssistantSupplierDirectory {
  /**
   * Authorizes `assistant:use` and reads the active business's suppliers whose folded name contains
   * one of the terms; a member who cannot read purchases gets none.
   */
  lookup(actor: ProductActor, terms: readonly string[]): Promise<AssistantDirectorySupplier[]>;
}

const maxTerms = 24;
const maxCandidates = 50;

// Lowercase, then strip the Spanish diacritics so "cafe" finds "Café"; kept in sync with the
// assistant's own folding of what was heard.
const accented = "áàäâãéèëêíìïîóòöôõúùüûñç";
const plain = "aaaaaeeeeiiiiooooouuuunc";

function folded(column: AnyPgColumn): SQL {
  return sql`translate(lower(${column}), ${accented}, ${plain})`;
}

/** Terms are folded by the caller; LIKE wildcards in them are escaped here. */
function containsTerm(column: AnyPgColumn, term: string): SQL {
  return sql`${folded(column)} like ${`%${term.replace(/[\\%_]/g, "\\$&")}%`} escape '\\'`;
}

function containsAnyTerm(column: AnyPgColumn, terms: readonly string[]): SQL | undefined {
  return or(...terms.map((term) => containsTerm(column, term)));
}

/** How many of the terms a name contains; candidates naming more of what was heard come first. */
function termHits(column: AnyPgColumn, terms: readonly string[]): SQL {
  return sql.join(
    terms.map((term) => sql`(${containsTerm(column, term)})::int`),
    sql` + `,
  );
}

function boundedTerms(terms: readonly string[]): string[] {
  return [...new Set(terms.map((term) => term.trim()).filter((term) => term.length >= 2))].slice(
    0,
    maxTerms,
  );
}

export function createAssistantDirectory(db: Database): AssistantDirectoryRepository {
  return {
    async authorize(actor) {
      return db.transaction(
        async (tx) => {
          const access = await authorizeBusinessAction(tx, actor, ["assistant:use"], "none");
          return { businessId: access.businessId };
        },
        { accessMode: "read only" },
      );
    },

    async lookup(actor, terms) {
      return db.transaction(
        async (tx) => {
          const access = await authorizeBusinessAction(tx, actor, ["assistant:use"], "none");
          const permissions = resolveBusinessAccess(access.role)?.permissions ?? [];
          const can = (permission: BusinessPermission) => permissions.includes(permission);
          const [clock] = await tx.execute<{ local_date: string; local_time: string }>(sql`
            select
              to_char(transaction_timestamp() at time zone ${access.timeZone}, 'YYYY-MM-DD') as local_date,
              to_char(transaction_timestamp() at time zone ${access.timeZone}, 'HH24:MI') as local_time
          `);
          if (!clock) throw new Error("Database clock returned no row");

          const productTerms = boundedTerms(terms.products);
          const customerTerms = boundedTerms(terms.customers);
          const readStock = can("inventory:read");

          const products =
            can("catalog:read") && productTerms.length > 0
              ? await tx
                  .select({
                    id: catalogProduct.id,
                    name: catalogProduct.name,
                    sellingPriceMinorUnits: sql<
                      string | null
                    >`${catalogProduct.sellingPriceMinorUnits}::text`,
                    quantityPrecision: catalogProduct.quantityPrecision,
                    tracked: catalogProduct.tracked,
                    onHandMinorUnits: sql<string>`${onHandQuantity()}::text`,
                  })
                  .from(catalogProduct)
                  .where(
                    and(
                      eq(catalogProduct.businessId, access.businessId),
                      eq(catalogProduct.status, "active"),
                      containsAnyTerm(catalogProduct.name, productTerms),
                    ),
                  )
                  .orderBy(
                    desc(termHits(catalogProduct.name, productTerms)),
                    asc(catalogProduct.name),
                    asc(catalogProduct.id),
                  )
                  .limit(maxCandidates)
              : [];

          const customerRows =
            can("customers:read") && customerTerms.length > 0
              ? await tx
                  .select({ id: customer.id, name: customer.name })
                  .from(customer)
                  .where(
                    and(
                      eq(customer.businessId, access.businessId),
                      eq(customer.status, "active"),
                      containsAnyTerm(customer.name, customerTerms),
                    ),
                  )
                  .orderBy(
                    desc(termHits(customer.name, customerTerms)),
                    asc(customer.name),
                    asc(customer.id),
                  )
                  .limit(maxCandidates)
              : [];

          const openReceivables = new Map<
            string,
            { id: string; description: string; balanceMinorUnits: string }
          >();
          if (can("receivables:read") && customerRows.length > 0) {
            const rows = await tx.execute<{
              customer_id: string;
              id: string;
              description: string;
              balance: string;
            }>(sql`
              with payment_totals as (${paymentTotals(access.businessId)})
              select distinct on (${receivable.customerId})
                ${receivable.customerId} as customer_id,
                ${receivable.id} as id,
                ${receivable.description} as description,
                (${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric))::text as balance
              from ${receivable}
              left join payment_totals on payment_totals.receivable_id = ${receivable.id}
              where ${receivable.businessId} = ${access.businessId}
                and ${receivable.status} = 'posted'
                and ${inArray(
                  receivable.customerId,
                  customerRows.map((row) => row.id),
                )}
                and ${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric) > 0
              order by ${receivable.customerId}, ${receivable.postedDate}, ${receivable.createdAt}, ${receivable.id}
            `);
            for (const row of rows) {
              openReceivables.set(row.customer_id, {
                id: row.id,
                description: row.description,
                balanceMinorUnits: row.balance,
              });
            }
          }

          // A sale needs the account the money enters, so sellers see account names too.
          const accounts =
            can("cash:read") || can("sales:create")
              ? await tx
                  .select({ id: cashAccount.id, name: cashAccount.name, kind: cashAccount.kind })
                  .from(cashAccount)
                  .where(
                    and(
                      eq(cashAccount.businessId, access.businessId),
                      eq(cashAccount.status, "active"),
                      eq(cashAccount.currency, access.currency),
                    ),
                  )
                  .orderBy(asc(cashAccount.createdAt), asc(cashAccount.id))
              : [];

          return {
            context: {
              businessId: access.businessId,
              currency: access.currency,
              currencyMinorUnitDigits: access.currencyMinorUnitDigits,
              timeZone: access.timeZone,
              localDate: clock.local_date,
              localTime: clock.local_time,
              permissions,
            },
            products: products.map((product) => ({
              ...product,
              onHandMinorUnits: readStock && product.tracked ? product.onHandMinorUnits : null,
            })),
            customers: customerRows.map((row) => ({
              ...row,
              oldestOpenReceivable: openReceivables.get(row.id) ?? null,
            })),
            accounts: accounts.map((account) => ({
              ...account,
              kind: account.kind as AssistantDirectoryAccount["kind"],
            })),
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}

export function createAssistantSupplierDirectory(db: Database): AssistantSupplierDirectory {
  return {
    async lookup(actor, rawTerms) {
      return db.transaction(
        async (tx) => {
          const access = await authorizeBusinessAction(tx, actor, ["assistant:use"], "none");
          const terms = boundedTerms(rawTerms);
          if (!hasBusinessPermission(access.role, "purchases:read") || terms.length === 0) {
            return [];
          }
          const suppliers = await tx
            .select({ id: supplier.id, name: supplier.name })
            .from(supplier)
            .where(
              and(
                eq(supplier.businessId, access.businessId),
                eq(supplier.status, "active"),
                containsAnyTerm(supplier.name, terms),
              ),
            )
            .orderBy(desc(termHits(supplier.name, terms)), asc(supplier.name), asc(supplier.id))
            .limit(maxCandidates);
          if (suppliers.length === 0) return [];

          const rows = await tx.execute<{
            supplier_id: string;
            id: string;
            invoice_number: string | null;
            balance: string;
          }>(sql`
            with payment_totals as (${supplierPaymentTotals(access.businessId)})
            select distinct on (${purchase.supplierId})
              ${purchase.supplierId} as supplier_id,
              ${purchase.id} as id,
              ${purchase.invoiceNumber} as invoice_number,
              (${purchaseBalance()})::text as balance
            from ${purchase}
            left join payment_totals on payment_totals.purchase_id = ${purchase.id}
            where ${purchase.businessId} = ${access.businessId}
              and ${purchase.status} = 'posted'
              and ${inArray(
                purchase.supplierId,
                suppliers.map((row) => row.id),
              )}
              and ${purchaseBalance()} > 0
            order by ${purchase.supplierId}, ${purchase.dueDate} nulls last, ${purchase.occurredAt}, ${purchase.id}
          `);
          const openPurchases = new Map(
            rows.map((row) => [
              row.supplier_id,
              { id: row.id, invoiceNumber: row.invoice_number, balanceMinorUnits: row.balance },
            ]),
          );
          return suppliers.map((row) => ({
            ...row,
            oldestOpenPurchase: openPurchases.get(row.id) ?? null,
          }));
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
