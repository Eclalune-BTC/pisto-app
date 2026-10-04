import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CustomersScreen } from "@/features/customers/customers-screen";
import {
  customerListSearchParams,
  parseCustomerListParams,
} from "@/features/customers/list-params";
import { customerDetailQueryOptions, customersQueryOptions } from "@/features/customers/queries";
import { readState } from "@/features/customers/read-state";
import { ScreenState } from "@/features/customers/screen-state";
import type { CustomerBalanceCell, CustomersLoadState } from "@/features/customers/types";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/features/customers/use-debounced-value";
import { hasDeniedRead } from "@/lib/query-state";

export default function CustomersRoute() {
  const router = useRouter();
  const filters = parseCustomerListParams(useLocalSearchParams<{ q?: string; status?: string }>());
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const [search, setSearch] = useState(filters.query);
  const typedQuery = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  // The URL owns the applied search; this remembers what the input last wrote there.
  const writtenQuery = useRef(filters.query);
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.canRead);
  const customers = useInfiniteQuery({
    ...customersQueryOptions(businessId, {
      query: filters.query || undefined,
      status: filters.status,
    }),
    enabled,
  });
  const items = customers.data?.pages.flatMap((page) => page.items) ?? [];
  const balances = useQueries({
    queries: items.map((customer) => ({
      ...customerDetailQueryOptions(businessId, customer.id),
      enabled,
    })),
  });

  useEffect(() => {
    if (typedQuery === writtenQuery.current) return;
    writtenQuery.current = typedQuery;
    router.setParams({ q: typedQuery || undefined });
  }, [router, typedQuery]);
  useEffect(() => {
    if (filters.query === writtenQuery.current) return;
    writtenQuery.current = filters.query;
    setSearch(filters.query);
  }, [filters.query]);

  const accessState = capabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready") {
    return <ScreenState kind={accessState} onRetry={() => void access.refetch()} />;
  }

  // A balance rejected for access revokes the whole private list, not only its cell.
  const read = hasDeniedRead(balances) ? { kind: "denied" as const } : readState([customers]);
  let state: CustomersLoadState;
  if (read.kind === "ready" && customers.data) {
    const stale = read.stale || access.isStale;
    state =
      items.length === 0
        ? { kind: "empty", stale }
        : {
            kind: "ready",
            items,
            loadingMore: customers.isFetchingNextPage,
            nextCursor: customers.data.pages.at(-1)?.nextCursor ?? null,
            stale,
          };
  } else {
    state = { kind: read.kind === "ready" || read.kind === "notFound" ? "error" : read.kind };
  }

  const balanceFor = (customerId: string): CustomerBalanceCell => {
    const balance = balances[items.findIndex((customer) => customer.id === customerId)];
    if (balance?.data) return { kind: "ready", balance: balance.data.balance };
    return balance?.isPending && balance.fetchStatus !== "paused"
      ? { kind: "loading" }
      : { kind: "unavailable" };
  };

  return (
    <CustomersScreen
      balanceFor={balanceFor}
      canCreate={access.hasManagePermission}
      onLoadMore={() => void customers.fetchNextPage()}
      onRetry={() => {
        void access.refetch();
        void customers.refetch();
        for (const balance of balances) void balance.refetch();
      }}
      onSearchChange={setSearch}
      onStatusChange={(status) =>
        router.setParams(customerListSearchParams({ query: filters.query, status }))
      }
      query={filters.query}
      search={search}
      searching={search.trim() !== filters.query}
      state={state}
      status={filters.status}
    />
  );
}
