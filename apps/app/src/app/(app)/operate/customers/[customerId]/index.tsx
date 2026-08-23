import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { buildCustomersCopy } from "@/features/customers/copy";
import { CustomerDetailScreen } from "@/features/customers/customer-detail-screen";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { isPausedWithoutData, readFailureKind } from "@/features/customers/remote-state";
import type { CustomerDetailLoadState } from "@/features/customers/types";
import { formatBusinessLocalDate } from "@/features/receivables/presentation";
import { receivablesQueryOptions } from "@/features/receivables/queries";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";

export default function CustomerDetailRoute() {
  const { i18n, t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  const router = useRouter();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const params = useLocalSearchParams<{ customerId?: string | string[] }>();
  const customerId = Array.isArray(params.customerId) ? params.customerId[0] : params.customerId;
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const businessId = access.business?.id ?? "inactive-business";
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId ?? "missing-customer"),
    enabled: Boolean(access.business && access.canRead && customerId),
  });
  const receivables = useInfiniteQuery({
    ...receivablesQueryOptions(businessId, {
      customerId: customerId ?? "00000000-0000-4000-8000-000000000000",
      state: "all",
    }),
    enabled: Boolean(access.business && access.canRead && customerId),
  });
  const boundaryState = capabilityBoundaryState(access);

  if (!access.business && boundaryState === "ready") return <Redirect href="/business" />;

  let state: CustomerDetailLoadState;
  const hasCombinedData = Boolean(customer.data && receivables.data);
  if (!access.canRead && access.business) {
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
      stale: customer.isError || receivables.isError || access.isStale,
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
        onArchive={() =>
          router.push({
            pathname: "/operate/customers/[customerId]/archive",
            params: { customerId: customerId ?? "" },
          })
        }
        onBack={() => router.replace("/operate/customers")}
        onCreateReceivable={() =>
          router.push({
            pathname: "/operate/receivables/new",
            params: { customerId: customerId ?? "" },
          })
        }
        onEdit={() =>
          router.push({
            pathname: "/operate/customers/[customerId]/edit",
            params: { customerId: customerId ?? "" },
          })
        }
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
