import { useInfiniteQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { buildCustomersCopy } from "@/features/customers/copy";
import { type CustomerStatusFilter, CustomersScreen } from "@/features/customers/customers-screen";
import { customersQueryOptions } from "@/features/customers/queries";
import { isPausedWithoutData, readFailureKind } from "@/features/customers/remote-state";
import type { CustomersLoadState } from "@/features/customers/types";

export default function CustomersRoute() {
  const { t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  const router = useRouter();
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatusFilter>("active");
  const deferredSearch = useDeferredValue(search.trim());
  const filters = useMemo(
    () => ({ query: deferredSearch || undefined, status }),
    [deferredSearch, status],
  );
  const businessId = access.business?.id ?? "inactive-business";
  const customers = useInfiniteQuery({
    ...customersQueryOptions(businessId, filters),
    enabled: Boolean(access.business && access.canRead),
  });

  if (!access.business && capabilityBoundaryState(access) === "ready") {
    return <Redirect href="/business" />;
  }

  let state: CustomersLoadState;
  if (!access.canRead && access.business) {
    state = { kind: "denied" };
  } else if (isPausedWithoutData(customers.fetchStatus, Boolean(customers.data))) {
    state = { kind: "offline" };
  } else if (customers.isPending) {
    state = { kind: "loading" };
  } else if (customers.isError && !customers.data) {
    state = { kind: readFailureKind(customers.error) === "denied" ? "denied" : "error" };
  } else {
    const items = customers.data?.pages.flatMap((page) => page.items) ?? [];
    state =
      items.length === 0
        ? { kind: "empty", stale: customers.isError || access.isStale }
        : {
            kind: "ready",
            items,
            loadingMore: customers.isFetchingNextPage,
            nextCursor: customers.data?.pages.at(-1)?.nextCursor ?? null,
            stale: customers.isError || access.isStale,
          };
  }

  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={capabilityBoundaryState(access)}>
      <CustomersScreen
        canManage={
          access.canManage && !((state.kind === "ready" || state.kind === "empty") && state.stale)
        }
        copy={copy.customers.list}
        onCreate={() => router.push("/operate/customers/new")}
        onLoadMore={() => customers.fetchNextPage()}
        onOpenCustomer={(customerId) =>
          router.push({
            pathname: "/operate/customers/[customerId]",
            params: { customerId },
          })
        }
        onRetry={() => customers.refetch()}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        searchQuery={search}
        state={state}
        status={status}
      />
    </CapabilityBoundary>
  );
}
