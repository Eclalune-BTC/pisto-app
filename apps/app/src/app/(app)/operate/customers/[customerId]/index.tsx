import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { buildCustomersCopy } from "@/features/customers/copy";
import { CustomerDetailScreen } from "@/features/customers/customer-detail-screen";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import type { CustomerDetailLoadState } from "@/features/customers/types";
import { formatBusinessLocalDate } from "@/features/receivables/presentation";
import { receivablesQueryOptions } from "@/features/receivables/queries";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
import {
  hasDeniedRead,
  isPausedWithoutData,
  queryHasStaleData,
  readFailureKind,
} from "@/lib/query-state";

export default function CustomerDetailRoute() {
  const { i18n, t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  const router = useRouter();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const params = useLocalSearchParams<{ customerId?: string | string[] }>();
  const customerId = Array.isArray(params.customerId) ? params.customerId[0] : params.customerId;
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const businessId = access.business?.id;
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId),
    enabled: Boolean(access.business && access.canRead && customerId),
  });
  const receivables = useInfiniteQuery({
    ...receivablesQueryOptions(businessId, customerId ? { customerId, state: "all" } : undefined),
    enabled: Boolean(access.business && access.canRead && customerId),
  });
  const boundaryState = capabilityBoundaryState(access);

  if (!access.business && boundaryState === "ready") return <Redirect href="/business" />;

  let state: CustomerDetailLoadState;
  const hasCombinedData = Boolean(customer.data && receivables.data);
  if ((!access.canRead && access.business) || hasDeniedRead([customer, receivables])) {
    state = { kind: "denied" };
  } else if (!customerId) {
    state = { kind: "notFound" };
  } else if (
    isPausedWithoutData(customer.fetchStatus, Boolean(customer.data)) ||
    isPausedWithoutData(receivables.fetchStatus, Boolean(receivables.data))
  ) {
    state = { kind: "offline" };
  } else if (customer.isPending || receivables.isPending) {
    state = { kind: "loading" };
  } else if ((customer.isError || receivables.isError) && !hasCombinedData) {
    const failure = customer.isError
      ? readFailureKind(customer.error)
      : readFailureKind(receivables.error);
    state = {
      kind: failure === "notFound" ? "notFound" : failure === "denied" ? "denied" : "error",
    };
  } else if (customer.data && receivables.data) {
    state = {
      kind: "ready",
      detail: customer.data,
      receivables: receivables.data.pages.flatMap((page) => page.items),
      receivablesLoadingMore: receivables.isFetchingNextPage,
      receivablesNextCursor: receivables.data.pages.at(-1)?.nextCursor ?? null,
      stale: queryHasStaleData(customer) || queryHasStaleData(receivables) || access.isStale,
    };
  } else {
    state = { kind: "error" };
  }

  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={boundaryState}>
      <CustomerDetailScreen
        canManage={access.canManage && !(state.kind === "ready" && state.stale)}
        copy={copy.customers.list}
        formatDate={(date) => formatBusinessLocalDate(date, locale)}
        formatMoney={(minorUnits, currency, digits) =>
          formatMinorUnits(minorUnits, currency, digits, locale)
        }
        onArchive={() => {
          if (state.kind !== "ready") return;
          router.push({
            pathname: "/operate/customers/[customerId]/archive",
            params: { customerId: state.detail.customer.id },
          });
        }}
        onBack={() => router.replace("/operate/customers")}
        onCreateReceivable={() => {
          if (state.kind !== "ready") return;
          router.push({
            pathname: "/operate/receivables/new",
            params: { customerId: state.detail.customer.id },
          });
        }}
        onEdit={() => {
          if (state.kind !== "ready") return;
          router.push({
            pathname: "/operate/customers/[customerId]/edit",
            params: { customerId: state.detail.customer.id },
          });
        }}
        onLoadMoreReceivables={() => receivables.fetchNextPage()}
        onOpenReceivable={(receivableId) =>
          router.push({
            pathname: "/operate/receivables/[receivableId]",
            params: { receivableId },
          })
        }
        onRetry={() => {
          void customer.refetch();
          void receivables.refetch();
        }}
        state={state}
      />
    </CapabilityBoundary>
  );
}
