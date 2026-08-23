import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { ActionUnavailable } from "@/features/customers/action-unavailable";
import { CapabilityBoundary } from "@/features/customers/capability-boundary";
import { customersReceivablesCopy as copy } from "@/features/customers/copy";
import { RecordBoundary, type RecordBoundaryState } from "@/features/customers/record-boundary";
import { isPausedWithoutData, readFailureKind } from "@/features/customers/remote-state";
import { receivablesApi } from "@/features/receivables/api";
import { buildVoidReceivableCommand } from "@/features/receivables/draft";
import {
  financialMutationState,
  invalidateReceivableMutation,
} from "@/features/receivables/mutation-state";
import { receivableDetailQueryOptions } from "@/features/receivables/queries";
import { VoidReceivableReview } from "@/features/receivables/receivable-reviews";
import { ReceivableVoidForm } from "@/features/receivables/receivable-void-form";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";

type VoidReceivableRequest = Parameters<typeof receivablesApi.void>[1];

export default function VoidReceivableRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const params = useLocalSearchParams<{ receivableId?: string | string[] }>();
  const receivableId = Array.isArray(params.receivableId)
    ? params.receivableId[0]
    : params.receivableId;
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const businessId = access.business?.id ?? "inactive-business";
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [command, setCommand] = useState<VoidReceivableRequest | null>(null);
  const detail = useQuery({
    ...receivableDetailQueryOptions(businessId, receivableId ?? "missing-receivable"),
    enabled: Boolean(access.business && access.canManage && receivableId),
  });
  const mutation = useMutation({
    mutationFn: (nextCommand: VoidReceivableRequest) =>
      receivablesApi.void(receivableId as string, nextCommand),
    onSuccess: async ({ receivable }) => {
      await invalidateReceivableMutation(queryClient, {
        businessId,
        customerId: receivable.customerId,
        receivableId: receivable.id,
      });
      goBack();
    },
  });
  const boundaryState = manageCapabilityBoundaryState(access);

  if (!access.business && boundaryState === "ready") return <Redirect href="/business" />;

  let recordState: RecordBoundaryState;
  if (!receivableId) recordState = "notFound";
  else if (isPausedWithoutData(detail.fetchStatus, Boolean(detail.data))) recordState = "offline";
  else if (detail.isPending) recordState = "loading";
  else if (detail.isError) recordState = readFailureKind(detail.error);
  else recordState = detail.data ? "ready" : "error";

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

  const prepareReview = () => {
    const result = buildVoidReceivableCommand(reason, Crypto.randomUUID());
    setReasonError("command" in result ? undefined : copy.receivables.validation.reason);
    if (!("command" in result)) return;
    setCommand(result.command);
    mutation.reset();
  };

  const receivable = detail.data?.receivable;
  const actionAllowed =
    receivable && receivable.state !== "voided" && receivable.paidMinorUnits === "0";
  return (
    <CapabilityBoundary onRetry={() => access.refetch()} state={boundaryState}>
      <RecordBoundary onBack={goBack} onRetry={() => detail.refetch()} state={recordState}>
        {receivable ? (
          !actionAllowed ? (
            <ActionUnavailable
              description={copy.receivables.route.actionUnavailableDescription}
              onBack={goBack}
              title={copy.receivables.route.actionUnavailableTitle}
            />
          ) : (
            <Page width="form">
              <ScreenHeader
                description={copy.receivables.route.voidDescription}
                title={copy.receivables.route.voidTitle}
              />
              {command ? (
                <VoidReceivableReview
                  amount={formatMinorUnits(
                    receivable.outstandingMinorUnits,
                    receivable.currency,
                    receivable.currencyMinorUnitDigits,
                    locale,
                  )}
                  copy={copy.receivables.review}
                  description={receivable.description}
                  mutation={financialMutationState(mutation)}
                  onCancel={() => {
                    setCommand(null);
                    mutation.reset();
                  }}
                  onConfirm={() => mutation.mutate(command)}
                  onRetrySameCommand={() => mutation.mutate(command)}
                  reason={command.reason}
                />
              ) : (
                <ReceivableVoidForm
                  canReview={reason.trim().length > 0}
                  copy={copy.receivables.voidForm}
                  error={reasonError}
                  onCancel={goBack}
                  onChangeReason={(value) => {
                    setReason(value);
                    setReasonError(undefined);
                  }}
                  onReview={prepareReview}
                  reason={reason}
                />
              )}
            </Page>
          )
        ) : null}
      </RecordBoundary>
    </CapabilityBoundary>
  );
}
