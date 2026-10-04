import { useQuery } from "@tanstack/react-query";
import { type Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { useRouteLabel } from "@/components/shell/shell-context";
import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { firstParam } from "@/features/customers/list-params";
import { readState } from "@/features/customers/read-state";
import { ScreenState } from "@/features/customers/screen-state";
import { cashAccountDetailQueryOptions } from "@/features/receivables/cash-account-source";
import { PaymentReversalEditor } from "@/features/receivables/payment-reversal-editor";
import { receivableDetailQueryOptions } from "@/features/receivables/queries";
import { isReversed } from "@/features/receivables/rules";

export default function ReversePaymentRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    paymentId?: string | string[];
    receivableId?: string | string[];
  }>();
  const receivableId = firstParam(params.receivableId);
  const paymentId = firstParam(params.paymentId);
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.canManage && receivableId && paymentId);
  const detail = useQuery({ ...receivableDetailQueryOptions(businessId, receivableId), enabled });
  const payment = detail.data?.payments.find((item) => item.id === paymentId);
  const account = useQuery({
    ...cashAccountDetailQueryOptions(businessId, payment?.cashAccountId),
    enabled: enabled && payment !== undefined,
  });
  useRouteLabel("/operate/receivables/[receivableId]", detail.data?.receivable.description);

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

  const detailRead =
    receivableId && paymentId ? readState([detail]) : { kind: "notFound" as const };
  const read =
    detailRead.kind === "ready" && !payment
      ? { kind: "notFound" as const }
      : detailRead.kind === "ready"
        ? readState([detail, account])
        : detailRead;
  if (read.kind !== "ready" || !receivableId || !detail.data || !payment || !account.data) {
    return (
      <ScreenState
        kind={read.kind === "ready" ? "error" : read.kind}
        onRetry={() => {
          void detail.refetch();
          void account.refetch();
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
    <PaymentReversalEditor
      accountName={account.data.account.name}
      availability={
        read.stale
          ? "stale"
          : payment.kind === "payment" && !isReversed(payment, detail.data.payments)
            ? "available"
            : "unavailable"
      }
      business={access.business}
      cancelHref={detailHref}
      onConfirmed={() => router.replace(detailHref)}
      onRetryRead={() => {
        void detail.refetch();
        void account.refetch();
      }}
      payment={payment}
    />
  );
}
