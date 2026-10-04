import { useQuery } from "@tanstack/react-query";
import { type Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { useRouteLabel } from "@/components/shell/shell-context";
import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { firstParam } from "@/features/customers/list-params";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { readState } from "@/features/customers/read-state";
import { ScreenState } from "@/features/customers/screen-state";
import { PaymentEditor } from "@/features/receivables/payment-editor";
import { receivableDetailQueryOptions } from "@/features/receivables/queries";
import { acceptsPayment } from "@/features/receivables/rules";
import { hasDeniedRead } from "@/lib/query-state";

export default function ApplyPaymentRoute() {
  const router = useRouter();
  const receivableId = firstParam(
    useLocalSearchParams<{ receivableId?: string | string[] }>().receivableId,
  );
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.hasManagePermission);
  const detail = useQuery({
    ...receivableDetailQueryOptions(businessId, receivableId),
    enabled: enabled && receivableId !== undefined,
  });
  const customerId = detail.data?.receivable.customerId;
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId),
    enabled: enabled && customerId !== undefined,
  });
  useRouteLabel(
    "/operate/receivables/[receivableId]",
    manageCapabilityBoundaryState(access) === "ready" && !hasDeniedRead([detail, customer])
      ? detail.data?.receivable.description
      : undefined,
  );

  const accessState = manageCapabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready" || !access.business) {
    return (
      <ScreenState
        kind={accessState === "ready" ? "error" : accessState}
        onRetry={() => void access.refetch()}
        skeleton="form"
        width="form"
      />
    );
  }

  const read = receivableId
    ? readState(customerId ? [detail, customer] : [detail])
    : { kind: "notFound" as const };
  if (read.kind !== "ready" || !receivableId || !detail.data || !customer.data) {
    return (
      <ScreenState
        kind={read.kind === "ready" ? "error" : read.kind}
        onRetry={() => {
          void detail.refetch();
          void customer.refetch();
        }}
        skeleton="form"
        width="form"
      />
    );
  }

  const detailHref: Href = {
    pathname: "/operate/receivables/[receivableId]",
    params: { receivableId },
  };
  return (
    <PaymentEditor
      availability={
        !acceptsPayment(detail.data.receivable, customer.data.customer.status === "active")
          ? "unavailable"
          : read.stale || access.isStale
            ? "stale"
            : "available"
      }
      business={access.business}
      cancelHref={detailHref}
      customerName={customer.data.customer.name}
      onConfirmed={() => router.replace(detailHref)}
      onRetryRead={() => {
        void access.refetch();
        void detail.refetch();
        void customer.refetch();
      }}
      receivable={detail.data.receivable}
    />
  );
}
