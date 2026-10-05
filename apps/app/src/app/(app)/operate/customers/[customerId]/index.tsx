import type { ArchiveCustomerRequest } from "@pisto/contracts";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { RouteState } from "@/components/route-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import {
  capabilityBoundaryState,
  resolveBusinessPermission,
  useCapabilityAccess,
} from "@/features/customers/access";
import { customersApi } from "@/features/customers/api";
import { CustomerArchiveDialog } from "@/features/customers/customer-archive-dialog";
import { CustomerDetailScreen } from "@/features/customers/customer-detail-screen";
import type { MenuTrigger } from "@/features/customers/overflow-action-menu";
import { customerDetailQueryOptions, customerQueryKeys } from "@/features/customers/queries";
import { readState } from "@/features/customers/read-state";
import type { CustomerDetailLoadState, CustomerReceivablesState } from "@/features/customers/types";
import { UncertainCommandNotice } from "@/features/customers/uncertain-command-notice";
import { useConfirmableCommand } from "@/features/customers/use-confirmable-command";
import { receivablesQueryOptions } from "@/features/receivables/queries";
import { notify } from "@/lib/notify";
import { hasDeniedRead } from "@/lib/query-state";
import { firstParam } from "@/lib/route-params";

export default function CustomerDetailRoute() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const customerId = firstParam(
    useLocalSearchParams<{ customerId?: string | string[] }>().customerId,
  );
  const access = useCapabilityAccess("customers:read", "customers:manage");
  const menuTriggerRef = useRef<MenuTrigger>(null);
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
  // A rejected read or a lost permission must not leave the record's name in the breadcrumb.
  useRouteLabel(
    "/operate/customers/[customerId]",
    capabilityBoundaryState(access) === "ready" && !hasDeniedRead([customer, receivables])
      ? customer.data?.customer.name
      : undefined,
  );

  const accessState = capabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready") {
    return <RouteState kind={accessState} onRetry={() => void access.refetch()} variant="detail" />;
  }

  // Both reads come from the same business access, so a rejected one hides the whole record.
  const read = !customerId
    ? { kind: "notFound" as const }
    : hasDeniedRead([receivables])
      ? { kind: "denied" as const }
      : readState([customer]);
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
  const retry = () => {
    void access.refetch();
    void customer.refetch();
    void receivables.refetch();
  };

  // Actions follow permission; a stale read blocks only the confirmation of a new command.
  return (
    <>
      <CustomerDetailScreen
        canCharge={resolveBusinessPermission(access.business, "receivables:manage")}
        canManage={access.hasManagePermission}
        menuTriggerRef={menuTriggerRef}
        notice={
          archive.state.phase === "uncertain" && !archive.open ? (
            <UncertainCommandNotice
              message={archive.state.message}
              onResume={() => archive.onOpenChange(true)}
            />
          ) : null
        }
        onArchive={() => archive.onOpenChange(true)}
        onLoadMoreReceivables={() => void receivables.fetchNextPage()}
        onRetry={retry}
        state={state}
      />
      {state.kind === "ready" ? (
        <CustomerArchiveDialog
          action={archive}
          customerName={state.detail.customer.name}
          onRetryRead={retry}
          returnFocusRef={menuTriggerRef}
          stale={state.stale}
        />
      ) : null}
    </>
  );
}
