export const CUSTOMER_STATUS_FILTERS = ["active", "archived", "all"] as const;

export type CustomerStatusFilter = (typeof CUSTOMER_STATUS_FILTERS)[number];

export type CustomerListParams = { query: string; status: CustomerStatusFilter };

/** The contract's search limit; longer input could never be sent. */
export const CUSTOMER_SEARCH_MAX_LENGTH = 80;

type SearchParam = string | string[] | undefined;

export function firstParam(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isStatusFilter(value: string | undefined): value is CustomerStatusFilter {
  return CUSTOMER_STATUS_FILTERS.some((status) => status === value);
}

/**
 * Reads the list filters from the URL; an unknown status falls back to the documented default and
 * a search longer than the contract allows is cut to its limit.
 */
export function parseCustomerListParams(params: {
  q?: SearchParam;
  status?: SearchParam;
}): CustomerListParams {
  const status = firstParam(params.status);
  return {
    query: (firstParam(params.q) ?? "").trim().slice(0, CUSTOMER_SEARCH_MAX_LENGTH).trim(),
    status: isStatusFilter(status) ? status : "active",
  };
}

/** URL parameters for the filters; defaults are omitted so the plain list URL stays canonical. */
export function customerListSearchParams({ query, status }: CustomerListParams) {
  return { q: query || undefined, status: status === "active" ? undefined : status };
}
