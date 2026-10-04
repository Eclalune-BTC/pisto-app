import {
  minorUnitsSchema,
  positiveMinorUnitsSchema,
  signedAggregateIntegerSchema,
} from "@pisto/contracts";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import type { BusinessDatabaseExecutor } from "./business-access.ts";
import { ProductError } from "./errors.ts";

export function parseMinorUnits(
  value: string,
  label: string,
  { allowZero }: { allowZero: boolean },
): bigint {
  const schema = allowZero ? minorUnitsSchema : positiveMinorUnitsSchema;
  if (!schema.safeParse(value).success) {
    throw new ProductError(
      "VALIDATION_ERROR",
      `${label} must be a ${allowZero ? "non-negative" : "positive"} integer within the supported range`,
    );
  }
  return BigInt(value);
}

/**
 * Exact signed sum of an append-only ledger. A missing or malformed aggregate is a
 * repository fault, never a zero balance.
 */
export async function sumLedger(
  executor: BusinessDatabaseExecutor,
  ledger: { table: PgTable; amount: AnyPgColumn | SQL; where: SQL | undefined },
  label: string,
): Promise<bigint> {
  const [row] = await executor
    .select({ value: sql<string>`coalesce(sum(${ledger.amount}), 0)::text` })
    .from(ledger.table)
    .where(ledger.where);
  const parsed = signedAggregateIntegerSchema.safeParse(row?.value);
  if (!parsed.success) throw new Error(`${label} query returned no valid total`);
  return BigInt(parsed.data);
}
