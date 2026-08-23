import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { ActionUnavailable } from "@/features/customers/action-unavailable";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { customersReceivablesCopy as copy } from "@/features/customers/copy";
import { RecordBoundary, type RecordBoundaryState } from "@/features/customers/record-boundary";
import { isPausedWithoutData, readFailureKind } from "@/features/customers/remote-state";
import { receivablePaymentsEnabled } from "@/features/receivables/capabilities";
import { cashAccountDetailQueryOptions } from "@/features/receivables/cash-account-source";
import { PaymentCapabilityBoundary } from "@/features/receivables/payment-capability-boundary";
import { PaymentReversalEditor } from "@/features/receivables/payment-reversal-editor";
import { receivableDetailQueryOptions } from "@/features/receivables/queries";

export default function ReversePaymentRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    paymentId?: string | string[];
    receivableId?: string | string[];
  }>();
  const receivableId = Array.isArray(params.receivableId)
    ? params.receivableId[0]
    : params.receivableId;
  const paymentId = Array.isArray(params.paymentId) ? params.paymentId[0] : params.paymentId;
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const businessId = access.business?.id ?? "inactive-business";
  const detail = useQuery({
    ...receivableDetailQueryOptions(businessId, receivableId ?? "missing-receivable"),
    enabled: Boolean(access.business && access.canManage && receivableId && paymentId),
  });
  const payment = detail.data?.payments.find((item) => item.id === paymentId);
  const account = useQuery({
    ...cashAccountDetailQueryOptions(businessId, payment?.cashAccountId ?? "missing-account"),
    enabled: Boolean(access.business && access.canManage && payment),
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
  const hasCombinedData = Boolean(detail.data && payment && account.data);
  if (!receivableId || !paymentId) recordState = "notFound";
  else if (
    isPausedWithoutData(detail.fetchStatus, Boolean(detail.data)) ||
    (payment && isPausedWithoutData(account.fetchStatus, Boolean(account.data)))
  ) {
    recordState = "offline";
  } else if (detail.isPending || (payment && account.isPending)) {
    recordState = "loading";
  } else if (detail.isError || account.isError) {
    recordState = detail.isError ? readFailureKind(detail.error) : readFailureKind(account.error);
  } else if (detail.data && !payment) {
    recordState = "notFound";
  } else {
    recordState = hasCombinedData ? "ready" : "error";
  }

  const alreadyReversed = Boolean(
    payment &&
      detail.data?.payments.some(
        (item) => item.kind === "reversal" && item.reversesPaymentId === payment.id,
      ),
  );
  const actionAllowed = payment?.kind === "payment" && !alreadyReversed;

  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={boundaryState}>
      {!receivablePaymentsEnabled() ? (
        <PaymentCapabilityBoundary onBack={goBack} />
      ) : (
        <RecordBoundary
          onBack={goBack}
          onRetry={() => {
            void detail.refetch();
            void account.refetch();
          }}
          state={recordState}
        >
          {access.business && detail.data && payment && account.data ? (
            actionAllowed ? (
              <PaymentReversalEditor
                business={access.business}
                cashAccountName={account.data.account.name}
                onBack={goBack}
                onConfirmed={goBack}
                payment={payment}
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
      )}
    </CapabilityBoundary>
  );
}
