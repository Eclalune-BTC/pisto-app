import { uuidSchema } from "@pisto/contracts";

import { firstParam } from "@/lib/route-params";

export const RECEIVABLE_STATE_FILTERS = ["all", "open", "overdue", "paid", "voided"] as const;

export type ReceivableStateFilter = (typeof RECEIVABLE_STATE_FILTERS)[number];

export type ReceivableListParams = { customerId?: string; state: ReceivableStateFilter };

type SearchParam = string | string[] | undefined;

function isStateFilter(value: string | undefined): value is ReceivableStateFilter {
  return RECEIVABLE_STATE_FILTERS.some((state) => state === value);
}

/**
 * Reads the list filters from the URL. An unknown state falls back to the documented default and a
 * malformed customer identifier is not applied, so the visible filters always match the request.
 */
export function parseReceivableListParams(params: {
  customerId?: SearchParam;
  state?: SearchParam;
}): ReceivableListParams {
  const state = firstParam(params.state);
  const customerId = firstParam(params.customerId);
  return {
    customerId: uuidSchema.safeParse(customerId).success ? customerId : undefined,
    state: isStateFilter(state) ? state : "all",
  };
}

/** URL parameters for the filters; defaults are omitted so the plain list URL stays canonical. */
export function receivableListSearchParams({ customerId, state }: ReceivableListParams) {
  return { customerId, state: state === "all" ? undefined : state };
}
