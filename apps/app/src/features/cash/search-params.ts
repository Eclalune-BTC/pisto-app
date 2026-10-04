import type { CashAccountStatus } from "@pisto/contracts";

export type CashAccountStatusFilter = CashAccountStatus | "all";

/** A route parameter as Expo Router delivers it: absent, single or repeated. */
export type RouteParam = string | string[] | undefined;

export function firstParam(value: RouteParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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
