import { useQueries, useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { buildCustomersCopy } from "@/features/customers/copy";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { isPausedWithoutData, readFailureKind } from "@/features/customers/remote-state";
import { cashAccountDetailQueryOptions } from "@/features/receivables/cash-account-source";
import { formatBusinessLocalDate, uniqueValues } from "@/features/receivables/presentation";
import { receivableDetailQueryOptions } from "@/features/receivables/queries";
import { ReceivableDetailScreen } from "@/features/receivables/receivable-detail-screen";
import type { ReceivableDetailLoadState } from "@/features/receivables/types";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";

export default function ReceivableDetailRoute() {
  const { i18n, t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  const router = useRouter();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const params = useLocalSearchParams<{ receivableId?: string | string[] }>();
  const receivableId = Array.isArray(params.receivableId)
    ? params.receivableId[0]
    : params.receivableId;
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const businessId = access.business?.id ?? "inactive-business";
  const detail = useQuery({
    ...receivableDetailQueryOptions(businessId, receivableId ?? "missing-receivable"),
    enabled: Boolean(access.business && access.canRead && receivableId),
  });
  const customerId = detail.data?.receivable.customerId;
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId ?? "missing-customer"),
    enabled: Boolean(access.business && access.canRead && customerId),
  });
  const accountIds = useMemo(
    () => uniqueValues(detail.data?.payments.map((payment) => payment.cashAccountId) ?? []),
    [detail.data?.payments],
  );
  const accountQueries = useQueries({
    queries: accountIds.map((accountId) => ({
      ...cashAccountDetailQueryOptions(businessId, accountId),
      enabled: Boolean(access.business && access.canRead),
    })),
  });
  const boundaryState = capabilityBoundaryState(access);

  if (!access.business && boundaryState === "ready") return <Redirect href="/business" />;

  let state: ReceivableDetailLoadState;
  const hasCombinedData = Boolean(detail.data && customer.data);
  if (!access.canRead && access.business) {
    state = { kind: "denied" };
  } else if (!receivableId) {
    state = { kind: "notFound" };
  } else if (
    isPausedWithoutData(detail.fetchStatus, Boolean(detail.data)) ||
    (customerId && isPausedWithoutData(customer.fetchStatus, Boolean(customer.data)))
  ) {
    state = { kind: "offline" };
  } else if (detail.isPending || (customerId && customer.isPending)) {
    state = { kind: "loading" };
  } else if ((detail.isError || customer.isError) && !hasCombinedData) {
    const failure = detail.isError
      ? readFailureKind(detail.error)
      : readFailureKind(customer.error);
    state = {
      kind: failure === "notFound" ? "notFound" : failure === "denied" ? "denied" : "error",
    };
  } else if (detail.data && customer.data) {
    state = {
      kind: "ready",
      payments: detail.data.payments,
      receivable: detail.data.receivable,
      stale:
        access.isStale ||
        detail.isError ||
        customer.isError ||
        accountQueries.some((query) => query.isError),
    };
  } else {
    state = { kind: "error" };
  }

  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={boundaryState}>
      <ReceivableDetailScreen
        canManage={access.canManage && !(state.kind === "ready" && state.stale)}
        cashAccountNameFor={(accountId) => {
          const index = accountIds.indexOf(accountId);
          const query = index >= 0 ? accountQueries[index] : undefined;
          return (
            query?.data?.account.name ??
            (query?.isPending
              ? copy.receivables.list.cashAccountLoading
              : copy.receivables.list.cashAccountUnavailable)
          );
        }}
        copy={copy.receivables.list}
        customerActive={customer.data?.customer.status === "active"}
        customerName={customer.data?.customer.name ?? copy.receivables.list.customerLoading}
        formatDate={(date) => formatBusinessLocalDate(date, locale)}
        formatMoney={(minorUnits, currency, digits) =>
          formatMinorUnits(minorUnits, currency, digits, locale)
        }
        onApplyPayment={() =>
          router.push({
            pathname: "/operate/receivables/[receivableId]/payment",
            params: { receivableId: receivableId ?? "" },
          })
        }
        onBack={() => router.replace("/operate/receivables")}
        onRetry={() => {
          void detail.refetch();
          void customer.refetch();
          for (const query of accountQueries) void query.refetch();
        }}
        onReversePayment={(paymentId) =>
          router.push({
            pathname: "/operate/receivables/[receivableId]/payments/[paymentId]/reverse",
            params: { paymentId, receivableId: receivableId ?? "" },
          })
        }
        onVoid={() =>
          router.push({
            pathname: "/operate/receivables/[receivableId]/void",
            params: { receivableId: receivableId ?? "" },
          })
        }
        state={state}
      />
    </CapabilityBoundary>
  );
}
