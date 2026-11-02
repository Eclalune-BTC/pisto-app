import { type MovementKindFilter, movementKindFilterSchema, uuidSchema } from "@pisto/contracts";

import { firstParam, type RouteParam } from "@/lib/route-params";
import type { MovementFilters } from "./queries";

/** Kinds this build can list; purchases and supplier payments join when their ledgers do. */
export const MOVEMENT_TABS = [
  "all",
  "sale",
  "expense",
  "receivable_payment",
] as const satisfies readonly MovementKindFilter[];

export type MovementTab = (typeof MOVEMENT_TABS)[number];

export const MOVEMENT_RANGES = ["today", "last7Days", "thisMonth", "last30Days"] as const;

export type MovementRange = (typeof MOVEMENT_RANGES)[number];

export type MovementSearchParams = {
  accountId?: RouteParam;
  kind?: RouteParam;
  q?: RouteParam;
  range?: RouteParam;
};

export type MovementListParams = {
  accountId?: string;
  kind: MovementTab;
  query: string;
  range: MovementRange;
};

const DEFAULT_RANGE: MovementRange = "last7Days";

function shiftLocalDate(localDate: string, days: number): string {
  return new Date(Date.parse(`${localDate}T00:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Unknown or malformed values fall back to the defaults instead of reaching the request. */
export function parseMovementParams(params: MovementSearchParams): MovementListParams {
  const kind = movementKindFilterSchema.safeParse(firstParam(params.kind));
  const range = firstParam(params.range);
  const accountId = firstParam(params.accountId);
  return {
    accountId: uuidSchema.safeParse(accountId).success ? accountId : undefined,
    kind:
      kind.success && (MOVEMENT_TABS as readonly string[]).includes(kind.data)
        ? (kind.data as MovementTab)
        : "all",
    query: (firstParam(params.q) ?? "").slice(0, 80),
    range: (MOVEMENT_RANGES as readonly string[]).includes(range ?? "")
      ? (range as MovementRange)
      : DEFAULT_RANGE,
  };
}

/** Defaults are omitted so the plain list keeps a clean URL. */
export function movementSearchParams(params: MovementListParams) {
  return {
    accountId: params.accountId,
    kind: params.kind === "all" ? undefined : params.kind,
    q: params.query.trim() ? params.query : undefined,
    range: params.range === DEFAULT_RANGE ? undefined : params.range,
  };
}

/** The inclusive local dates a range names, counted from the business's today. */
export function movementRangeDates(
  range: MovementRange,
  today: string,
): { startLocalDate: string; endLocalDate: string } {
  switch (range) {
    case "today":
      return { startLocalDate: today, endLocalDate: today };
    case "last7Days":
      return { startLocalDate: shiftLocalDate(today, -6), endLocalDate: today };
    case "thisMonth":
      return { startLocalDate: `${today.slice(0, 8)}01`, endLocalDate: today };
    case "last30Days":
      return { startLocalDate: shiftLocalDate(today, -29), endLocalDate: today };
  }
}

export function movementFilters(
  params: MovementListParams,
  today: string,
  search: string,
): MovementFilters {
  const trimmed = search.trim();
  return {
    ...movementRangeDates(params.range, today),
    kind: params.kind,
    accountId: params.accountId,
    query: trimmed ? trimmed : undefined,
  };
}
