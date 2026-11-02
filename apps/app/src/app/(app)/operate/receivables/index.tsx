import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { View } from "react-native";
import { RouteState } from "@/components/route-state";
import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CustomerPickerDialog } from "@/features/customers/customer-picker";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { type ReadQuery, readState } from "@/features/customers/read-state";
import {
  parseReceivableListParams,
  type ReceivableListParams,
  receivableListSearchParams,
} from "@/features/receivables/list-params";
import { uniqueValues } from "@/features/receivables/presentation";
import {
  receivablesQueryOptions,
  receivablesSummaryQueryOptions,
} from "@/features/receivables/queries";
import { ReceivablePaymentSheet } from "@/features/receivables/receivable-payment-sheet";
import { ReceivablesScreen } from "@/features/receivables/receivables-screen";
import type { CustomerNameCell } from "@/features/receivables/receivables-table";
import type { ReceivablesLoadState } from "@/features/receivables/types";
import { readFailureKind } from "@/lib/query-state";

function customerName(
  query: ReadQuery & { data?: { customer: { name: string; phone: string | null } } },
): CustomerNameCell {
  if (query.data) {
    return { kind: "ready", name: query.data.customer.name, phone: query.data.customer.phone };
  }
  return query.isPending && query.fetchStatus !== "paused"
    ? { kind: "loading" }
    : { kind: "unavailable" };
}

export default function ReceivablesRoute() {
  const router = useRouter();
  const filters = parseReceivableListParams(
    useLocalSearchParams<{ customerId?: string; state?: string }>(),
  );
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  // The customer picker either narrows the list or chooses who is paying.
  const [picker, setPicker] = useState<"filter" | "payment" | null>(null);
  const [payingCustomerId, setPayingCustomerId] = useState<string | null>(null);
  const customerFilterRef = useRef<View>(null);
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.canRead);
  const list = useInfiniteQuery({
    ...receivablesQueryOptions(businessId, {
      customerId: filters.customerId,
      state: filters.state,
    }),
    enabled,
  });
  const summary = useQuery({ ...receivablesSummaryQueryOptions(businessId), enabled });
  const filterCustomer = useQuery({
    ...customerDetailQueryOptions(businessId, filters.customerId),
    enabled: enabled && filters.customerId !== undefined,
  });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const customerIds = uniqueValues(items.map((item) => item.customerId));
  const customers = useQueries({
    queries: customerIds.map((customerId) => ({
      ...customerDetailQueryOptions(businessId, customerId),
      enabled,
    })),
  });

  const accessState = capabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready" || !access.business) {
    return (
      <RouteState
        kind={accessState === "ready" ? "error" : accessState}
        onRetry={() => void access.refetch()}
      />
    );
  }

  const setFilters = (next: ReceivableListParams) =>
    router.setParams(receivableListSearchParams(next));
  const read = readState([list, summary]);
  const names = filters.customerId ? [filterCustomer, ...customers] : customers;
  const namesDenied = readState(names).kind === "denied";
  let state: ReceivablesLoadState;
  if (namesDenied) {
    state = { kind: "denied" };
  } else if (read.kind === "ready" && list.data && summary.data) {
    // A name that could not be refreshed is stale; a filter customer that does not exist is not.
    const stale =
      read.stale ||
      access.isStale ||
      names.some(
        (query) =>
          (query.isError && readFailureKind(query.error) !== "notFound") ||
          query.fetchStatus === "paused",
      );
    state =
      items.length === 0
        ? { kind: "empty", stale, summary: summary.data.summary }
        : {
            kind: "ready",
            items,
            loadingMore: list.isFetchingNextPage,
            nextCursor: list.data.pages.at(-1)?.nextCursor ?? null,
            stale,
            summary: summary.data.summary,
          };
  } else {
    state = { kind: read.kind === "ready" || read.kind === "notFound" ? "error" : read.kind };
  }

  return (
    <>
      <ReceivablesScreen
        canCreate={access.hasManagePermission}
        customerFilter={filters.customerId ? customerName(filterCustomer) : null}
        customerFilterRef={customerFilterRef}
        customerNameFor={(customerId) => {
          const query = customers[customerIds.indexOf(customerId)];
          return query ? customerName(query) : { kind: "unavailable" };
        }}
        filters={filters}
        onChooseCustomer={() => setPicker("filter")}
        onClearCustomer={() => setFilters({ ...filters, customerId: undefined })}
        onClearFilters={() => setFilters({ state: "all" })}
        onLoadMore={() => void list.fetchNextPage()}
        onRegisterPayment={() => {
          if (filters.customerId) setPayingCustomerId(filters.customerId);
          else setPicker("payment");
        }}
        onRetry={() => {
          void access.refetch();
          void list.refetch();
          void summary.refetch();
          for (const query of names) void query.refetch();
        }}
        onStateChange={(next) => setFilters({ ...filters, state: next })}
        state={state}
      />
      <CustomerPickerDialog
        businessId={access.business.id}
        // Choosing a filter from cached names only narrows a read; it sends no command.
        freshChoiceOnly={false}
        onOpenChange={(open) => setPicker(open ? "filter" : null)}
        onSelect={(customer) => setFilters({ ...filters, customerId: customer.id })}
        open={picker === "filter"}
        returnFocusRef={customerFilterRef}
        selectedId={filters.customerId ?? null}
        status="all"
      />
      <CustomerPickerDialog
        businessId={access.business.id}
        // The payment itself is reviewed against a fresh read of the chosen customer's receivable.
        freshChoiceOnly={false}
        onOpenChange={(open) => setPicker(open ? "payment" : null)}
        onSelect={(customer) => setPayingCustomerId(customer.id)}
        open={picker === "payment"}
        selectedId={null}
        status="active"
      />
      <ReceivablePaymentSheet
        customerId={payingCustomerId ?? undefined}
        onOpenChange={(open) => {
          if (!open) setPayingCustomerId(null);
        }}
        open={payingCustomerId !== null}
      />
    </>
  );
}
