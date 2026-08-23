import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { buildCustomersCopy } from "@/features/customers/copy";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { isPausedWithoutData, readFailureKind } from "@/features/customers/remote-state";
import { formatBusinessLocalDate, uniqueValues } from "@/features/receivables/presentation";
import {
  receivablesQueryOptions,
  receivablesSummaryQueryOptions,
} from "@/features/receivables/queries";
import { ReceivablesScreen } from "@/features/receivables/receivables-screen";
import type { ReceivablesLoadState } from "@/features/receivables/types";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";

type ReceivableFilter = "all" | "open" | "overdue" | "paid" | "voided";

export default function ReceivablesRoute() {
  const { i18n, t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  const router = useRouter();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const [filter, setFilter] = useState<ReceivableFilter>("all");
  const businessId = access.business?.id ?? "inactive-business";
  const list = useInfiniteQuery({
    ...receivablesQueryOptions(businessId, { state: filter }),
    enabled: Boolean(access.business && access.canRead),
  });
  const summary = useQuery({
    ...receivablesSummaryQueryOptions(businessId),
    enabled: Boolean(access.business && access.canRead),
  });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const customerIds = useMemo(() => uniqueValues(items.map((item) => item.customerId)), [items]);
  const customerQueries = useQueries({
    queries: customerIds.map((customerId) => ({
      ...customerDetailQueryOptions(businessId, customerId),
      enabled: Boolean(access.business && access.canRead),
    })),
  });
  const boundaryState = capabilityBoundaryState(access);

  if (!access.business && boundaryState === "ready") return <Redirect href="/business" />;

  let state: ReceivablesLoadState;
  const hasCombinedData = Boolean(list.data && summary.data);
  if (!access.canRead && access.business) {
    state = { kind: "denied" };
  } else if (
    isPausedWithoutData(list.fetchStatus, Boolean(list.data)) ||
    isPausedWithoutData(summary.fetchStatus, Boolean(summary.data))
  ) {
    state = { kind: "offline" };
  } else if (list.isPending || summary.isPending) {
    state = { kind: "loading" };
  } else if ((list.isError || summary.isError) && !hasCombinedData) {
    const failure = list.isError ? readFailureKind(list.error) : readFailureKind(summary.error);
    state = { kind: failure === "denied" ? "denied" : "error" };
  } else if (list.data && summary.data) {
    const stale =
      access.isStale ||
      list.isError ||
      summary.isError ||
      customerQueries.some((query) => query.isError);
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
    state = { kind: "error" };
  }

  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={boundaryState}>
      <ReceivablesScreen
        canManage={
          access.canManage && !((state.kind === "ready" || state.kind === "empty") && state.stale)
        }
        copy={copy.receivables.list}
        customerNameFor={(customerId) => {
          const index = customerIds.indexOf(customerId);
          const query = index >= 0 ? customerQueries[index] : undefined;
          return (
            query?.data?.customer.name ??
            (query?.isPending
              ? copy.receivables.list.customerLoading
              : copy.receivables.list.customerUnavailable)
          );
        }}
        filter={filter}
        formatDate={(date) => formatBusinessLocalDate(date, locale)}
        formatMoney={(minorUnits, currency, digits) =>
          formatMinorUnits(minorUnits, currency, digits, locale)
        }
        onCreate={() => router.push("/operate/receivables/new")}
        onFilterChange={setFilter}
        onLoadMore={() => list.fetchNextPage()}
        onOpenReceivable={(receivableId) =>
          router.push({
            pathname: "/operate/receivables/[receivableId]",
            params: { receivableId },
          })
        }
        onRetry={() => {
          void list.refetch();
          void summary.refetch();
          for (const query of customerQueries) void query.refetch();
        }}
        state={state}
      />
    </CapabilityBoundary>
  );
}
