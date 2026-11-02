import type { BusinessPermission } from "@pisto/contracts";

/**
 * Read ports the deterministic post-processing resolves names through. Implementations authorize
 * the actor and read only the active business; the assistant never chooses a tenant.
 */
export interface DirectoryContext {
  currencyMinorUnitDigits: number;
  /** Business-local calendar date and minute, from the database clock. */
  localDate: string;
  localTime: string;
  permissions: readonly BusinessPermission[];
}

export interface DirectoryProduct {
  id: string;
  name: string;
  sellingPriceMinorUnits: string | null;
  quantityPrecision: number;
  tracked: boolean;
  onHandMinorUnits: string | null;
}

export interface DirectoryCustomer {
  id: string;
  name: string;
  oldestOpenReceivable: { id: string; description: string; balanceMinorUnits: string } | null;
}

export interface DirectoryAccount {
  id: string;
  name: string;
  kind: "cash" | "bank" | "mobile_money" | "other";
}

export interface RecordDirectory<Actor> {
  lookup(
    actor: Actor,
    terms: { products: readonly string[]; customers: readonly string[] },
  ): Promise<{
    context: DirectoryContext;
    products: readonly DirectoryProduct[];
    customers: readonly DirectoryCustomer[];
    accounts: readonly DirectoryAccount[];
  }>;
}

export interface DirectorySupplier {
  id: string;
  name: string;
  /** The supplier's oldest purchase that still has a balance, if any. */
  oldestOpenPurchase: {
    id: string;
    invoiceNumber: string | null;
    balanceMinorUnits: string;
  } | null;
}

export interface SupplierDirectory<Actor> {
  lookup(actor: Actor, terms: readonly string[]): Promise<readonly DirectorySupplier[]>;
}

/**
 * For a composition without a suppliers module: every supplier name is reported as not found.
 * It never fabricates a supplier.
 */
export const emptySupplierDirectory: SupplierDirectory<unknown> = {
  lookup: async () => [],
};
