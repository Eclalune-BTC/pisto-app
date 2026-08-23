import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { ActionUnavailable } from "@/features/customers/action-unavailable";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { customersReceivablesCopy as copy } from "@/features/customers/copy";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { RecordBoundary, type RecordBoundaryState } from "@/features/customers/record-boundary";
import { isPausedWithoutData, readFailureKind } from "@/features/customers/remote-state";
import { PaymentEditor } from "@/features/receivables/payment-editor";
import { receivableDetailQueryOptions } from "@/features/receivables/queries";

export default function ApplyPaymentRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ receivableId?: string | string[] }>();
  const receivableId = Array.isArray(params.receivableId)
    ? params.receivableId[0]
    : params.receivableId;
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const businessId = access.business?.id ?? "inactive-business";
  const detail = useQuery({
    ...receivableDetailQueryOptions(businessId, receivableId ?? "missing-receivable"),
    enabled: Boolean(access.business && access.canManage && receivableId),
  });
  const customerId = detail.data?.receivable.customerId;
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId ?? "missing-customer"),
    enabled: Boolean(access.business && access.canManage && customerId),
  });
  const boundaryState = manageCapabilityBoundaryState(access);

  if (!access.business && boundaryState === "ready") return <Redirect href="/business" />;

  function goBack() {
    if (receivableId) {
      router.replace({
        pathname: "/operate/receivables/[receivableId]",
        params: { receivableId },
      });
    } else {
      router.replace("/operate/receivables");
    }
  }

  let recordState: RecordBoundaryState;
  const hasCombinedData = Boolean(detail.data && customer.data);
  if (!receivableId) recordState = "notFound";
  else if (
    isPausedWithoutData(detail.fetchStatus, Boolean(detail.data)) ||
    (customerId && isPausedWithoutData(customer.fetchStatus, Boolean(customer.data)))
  ) {
    recordState = "offline";
  } else if (detail.isPending || (customerId && customer.isPending)) {
    recordState = "loading";
  } else if (detail.isError || customer.isError) {
    recordState = detail.isError ? readFailureKind(detail.error) : readFailureKind(customer.error);
  } else {
    recordState = hasCombinedData ? "ready" : "error";
  }

  const receivable = detail.data?.receivable;
  const actionAllowed =
    receivable &&
    customer.data?.customer.status === "active" &&
    (receivable.state === "open" || receivable.state === "overdue") &&
    receivable.outstandingMinorUnits !== "0";

  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={boundaryState}>
      <RecordBoundary
        onBack={goBack}
        onRetry={() => {
          void detail.refetch();
          void customer.refetch();
        }}
        state={recordState}
      >
        {access.business && receivable ? (
          actionAllowed ? (
            <PaymentEditor
              business={access.business}
              onBack={goBack}
              onConfirmed={goBack}
              receivable={receivable}
            />
          ) : (
            <ActionUnavailable
              description={copy.receivables.route.actionUnavailableDescription}
              onBack={goBack}
              title={copy.receivables.route.actionUnavailableTitle}
            />
          )
        ) : null}
      </RecordBoundary>
    </CapabilityBoundary>
  );
}
