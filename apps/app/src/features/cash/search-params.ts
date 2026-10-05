import type { CashAccountStatus } from "@pisto/contracts";
import { firstParam, type RouteParam } from "@/lib/route-params";

export type CashAccountStatusFilter = CashAccountStatus | "all";

const accountStatuses: readonly CashAccountStatusFilter[] = ["active", "archived", "all"];

/** Unknown values fall back to the default view instead of an invented filter. */
export function parseAccountStatus(value: RouteParam): CashAccountStatusFilter {
  const status = firstParam(value);
  return accountStatuses.find((candidate) => candidate === status) ?? "active";
}

/** The default view keeps a clean URL. */
export function accountStatusParam(status: CashAccountStatusFilter): string | undefined {
  return status === "active" ? undefined : status;
}
