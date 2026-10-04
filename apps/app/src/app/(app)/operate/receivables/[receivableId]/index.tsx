import type { VoidReceivableRequest } from "@pisto/contracts";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useRouteLabel } from "@/components/shell/shell-context";
import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { firstParam } from "@/features/customers/list-params";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { readState } from "@/features/customers/read-state";
import { ScreenState } from "@/features/customers/screen-state";
import { useConfirmableCommand } from "@/features/customers/use-confirmable-command";
import { receivablesApi } from "@/features/receivables/api";
import { cashAccountDetailQueryOptions } from "@/features/receivables/cash-account-source";
import { invalidateReceivableMutation } from "@/features/receivables/mutation-state";
import { uniqueValues } from "@/features/receivables/presentation";
import { receivableDetailQueryOptions } from "@/features/receivables/queries";
import { ReceivableDetailScreen } from "@/features/receivables/receivable-detail-screen";
import { ReceivableVoidDialog } from "@/features/receivables/receivable-void-dialog";
import { acceptsVoid } from "@/features/receivables/rules";
import type { AccountNameCell, ReceivableDetailLoadState } from "@/features/receivables/types";
import { notify } from "@/lib/notify";

export default function ReceivableDetailRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const receivableId = firstParam(
    useLocalSearchParams<{ receivableId?: string | string[] }>().receivableId,
  );
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.canRead);
  const detail = useQuery({
    ...receivableDetailQueryOptions(businessId, receivableId),
    enabled: enabled && receivableId !== undefined,
  });
  const customerId = detail.data?.receivable.customerId;
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId),
    enabled: enabled && customerId !== undefined,
  });
  const accountIds = uniqueValues(
    detail.data?.payments.map((payment) => payment.cashAccountId) ?? [],
  );
  const accounts = useQueries({
    queries: accountIds.map((accountId) => ({
      ...cashAccountDetailQueryOptions(businessId, accountId),
      enabled,
    })),
  });
  const voidCommand = useConfirmableCommand({
    conflictMessage: t("receivables.void.conflict"),
    mutationFn: (command: VoidReceivableRequest) => {
      if (!receivableId) throw new Error("Voiding a receivable requires its identifier");
      return receivablesApi.void(receivableId, command);
    },
    onConfirmed: async ({ receivable }) => {
      if (!businessId) throw new Error("Receivable invalidation requires its business");
      await invalidateReceivableMutation(queryClient, {
        businessId,
        customerId: receivable.customerId,
      });
      notify.success(t("receivables.void.done"), { description: receivable.description });
    },
  });
  useRouteLabel("/operate/receivables/[receivableId]", detail.data?.receivable.description);

  const accessState = capabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready" || !access.business) {
    return (
      <ScreenState
        kind={accessState === "ready" ? "error" : accessState}
        onRetry={() => void access.refetch()}
        skeleton="detail"
      />
    );
  }

  const read = receivableId
    ? readState(customerId ? [detail, customer] : [detail])
    : { kind: "notFound" as const };
  const accountsDenied = readState(accounts).kind === "denied";
  let state: ReceivableDetailLoadState;
  if (accountsDenied) {
    state = { kind: "denied" };
  } else if (read.kind === "ready" && detail.data && customer.data) {
    state = {
      kind: "ready",
      customer: {
        active: customer.data.customer.status === "active",
        id: customer.data.customer.id,
        name: customer.data.customer.name,
      },
      payments: detail.data.payments,
      receivable: detail.data.receivable,
      stale:
        read.stale ||
        access.isStale ||
        accounts.some((query) => query.isError || query.fetchStatus === "paused"),
    };
  } else {
    state = { kind: read.kind === "ready" ? "error" : read.kind };
  }
  const writable = access.canManage && !(state.kind === "ready" && state.stale);

  return (
    <>
      <ReceivableDetailScreen
        accountNameFor={(accountId): AccountNameCell => {
          const query = accounts[accountIds.indexOf(accountId)];
          if (query?.data) return { kind: "ready", name: query.data.account.name };
          return query?.isPending && query.fetchStatus !== "paused"
            ? { kind: "loading" }
            : { kind: "unavailable" };
        }}
        canManage={writable}
        onRetry={() => {
          void detail.refetch();
          void customer.refetch();
          for (const query of accounts) void query.refetch();
        }}
        onReversePayment={(paymentId) => {
          if (!receivableId) return;
          router.push({
            pathname: "/operate/receivables/[receivableId]/payments/[paymentId]/reverse",
            params: { paymentId, receivableId },
          });
        }}
        onVoid={() => voidCommand.onOpenChange(true)}
        state={state}
        timeZone={access.business.timeZone}
      />
      {state.kind === "ready" && (acceptsVoid(state.receivable) || voidCommand.open) ? (
        <ReceivableVoidDialog
          action={voidCommand}
          key={voidCommand.session}
          receivable={state.receivable}
        />
      ) : null}
    </>
  );
}
