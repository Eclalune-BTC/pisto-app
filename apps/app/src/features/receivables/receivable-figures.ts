import type { CashAccount, ReceivableAging } from "@pisto/contracts";

export type AgingBucket = keyof ReceivableAging;

export const AGING_BUCKETS: readonly AgingBucket[] = [
  "current",
  "days1To30",
  "days31To60",
  "over60",
];

/** Each bucket's share of the open balance in hundredths of a percent, exact in BigInt. */
export function agingShares(aging: ReceivableAging): Record<AgingBucket, number> {
  const total = AGING_BUCKETS.reduce(
    (sum, bucket) => sum + BigInt(aging[bucket].outstandingMinorUnits),
    0n,
  );
  const shares = {} as Record<AgingBucket, number>;
  for (const bucket of AGING_BUCKETS) {
    shares[bucket] =
      total === 0n ? 0 : Number((BigInt(aging[bucket].outstandingMinorUnits) * 10_000n) / total);
  }
  return shares;
}

const DAY_MS = 86_400_000;

/** Whole days from a due date to the business date; positive once the due date has passed. */
export function daysPastDue(dueDate: string, businessLocalDate: string): number {
  return Math.round(
    (Date.parse(`${businessLocalDate}T00:00:00.000Z`) - Date.parse(`${dueDate}T00:00:00.000Z`)) /
      DAY_MS,
  );
}

export type PaymentMethod = "cash" | "transfer";

/** Cash goes into a cash box; a transfer lands in a bank or mobile-money account. */
export function accountsForMethod(accounts: CashAccount[], method: PaymentMethod): CashAccount[] {
  return accounts.filter(
    (account) => account.status === "active" && (method === "cash") === (account.kind === "cash"),
  );
}

/** Whole-currency shortcuts below the balance; the full balance has its own chip. */
export function quickAmounts(outstandingMinorUnits: string, digits: number): string[] {
  const unit = 10n ** BigInt(digits);
  const outstanding = BigInt(outstandingMinorUnits);
  return [10n, 20n]
    .map((whole) => whole * unit)
    .filter((amount) => amount < outstanding)
    .map((amount) => amount.toString());
}
