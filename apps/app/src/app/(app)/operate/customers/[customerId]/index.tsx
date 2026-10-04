import type { ArchiveCustomerRequest } from "@pisto/contracts";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { useRouteLabel } from "@/components/shell/shell-context";
import {
  capabilityBoundaryState,
  resolveBusinessPermission,
  useCapabilityAccess,
} from "@/features/customers/access";
import { customersApi } from "@/features/customers/api";
import { CustomerArchiveDialog } from "@/features/customers/customer-archive-dialog";
import { CustomerDetailScreen } from "@/features/customers/customer-detail-screen";
import { firstParam } from "@/features/customers/list-params";
import { customerDetailQueryOptions, customerQueryKeys } from "@/features/customers/queries";
import { readState } from "@/features/customers/read-state";
import { ScreenState } from "@/features/customers/screen-state";
import type { CustomerDetailLoadState, CustomerReceivablesState } from "@/features/customers/types";
import { useConfirmableCommand } from "@/features/customers/use-confirmable-command";
import { receivablesQueryOptions } from "@/features/receivables/queries";
import { notify } from "@/lib/notify";

export default function CustomerDetailRoute() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const customerId = firstParam(
    useLocalSearchParams<{ customerId?: string | string[] }>().customerId,
  );
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.canRead && customerId);
  const customer = useQuery({ ...customerDetailQueryOptions(businessId, customerId), enabled });
  const receivables = useInfiniteQuery({
    ...receivablesQueryOptions(businessId, customerId ? { customerId, state: "all" } : undefined),
    enabled,
  });
  const archive = useConfirmableCommand({
    conflictMessage: t("customers.archive.conflict"),
    mutationFn: (command: ArchiveCustomerRequest) => {
      if (!customerId) throw new Error("Archiving a customer requires its identifier");
      return customersApi.archive(customerId, command);
    },
    onConfirmed: async ({ customer: archived }) => {
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.all(businessId) });
      notify.success(t("customers.archive.done"), { description: archived.name });
    },
  });
  useRouteLabel("/operate/customers/[customerId]", customer.data?.customer.name);

  const accessState = capabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready") {
    return (
      <ScreenState kind={accessState} onRetry={() => void access.refetch()} skeleton="detail" />
    );
  }

  const read = customerId ? readState([customer]) : { kind: "notFound" as const };
  const receivablesRead = readState([receivables]);
  let receivablesState: CustomerReceivablesState;
  if (receivablesRead.kind === "ready" && receivables.data) {
    receivablesState = {
      kind: "ready",
      items: receivables.data.pages.flatMap((page) => page.items),
      loadingMore: receivables.isFetchingNextPage,
      nextCursor: receivables.data.pages.at(-1)?.nextCursor ?? null,
    };
  } else {
    receivablesState = {
      kind:
        receivablesRead.kind === "ready" || receivablesRead.kind === "notFound"
          ? "error"
          : receivablesRead.kind,
    };
  }

  let state: CustomerDetailLoadState;
  if (read.kind === "ready" && customer.data) {
    state = {
      kind: "ready",
      detail: customer.data,
      receivables: receivablesState,
      stale:
        read.stale || access.isStale || (receivablesRead.kind === "ready" && receivablesRead.stale),
    };
  } else {
    state = { kind: read.kind === "ready" ? "error" : read.kind };
  }
  const writable = !(state.kind === "ready" && state.stale);

  return (
    <>
      <CustomerDetailScreen
        canCharge={writable && resolveBusinessPermission(access.business, "receivables:manage")}
        canManage={access.canManage && writable}
        onArchive={() => archive.onOpenChange(true)}
        onLoadMoreReceivables={() => void receivables.fetchNextPage()}
        onRetry={() => {
          void customer.refetch();
          void receivables.refetch();
        }}
        state={state}
      />
      {state.kind === "ready" ? (
        <CustomerArchiveDialog action={archive} customerName={state.detail.customer.name} />
      ) : null}
    </>
  );
}
