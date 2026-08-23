import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { ApiClientError } from "@/lib/api-error";
import { formatMinorUnits } from "@/lib/money";
import { cashApi } from "./api";
import { CashAccountDetailScreen } from "./cash-account-detail-screen";
import { CashMovementDetailController } from "./cash-movement-detail-controller";
import { cashAccountDetailCopy, cashErrorMessage, cashUiCopy } from "./copy";
import { invalidateCashLedger } from "./invalidate";
import { cashConfirmationState } from "./mutation-state";
import { cashAccountQueryOptions, cashMovementsInfiniteOptions, flattenPages } from "./queries";
import { featureRemoteState, queryHasStaleData } from "./remote-state";
import { useCashAccess } from "./use-cash-access";

export function CashAccountDetailController() {
  const params = useLocalSearchParams<{ accountId?: string | string[] }>();
  const accountId = Array.isArray(params.accountId) ? params.accountId[0] : params.accountId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    business,
    businesses,
    canManage,
    canRead,
    isStale: accessIsStale,
  } = useCashAccess("cash");
  const businessId = business?.id ?? "unselected";
  const accountQuery = useQuery({
    ...cashAccountQueryOptions(businessId, accountId ?? "missing"),
    enabled: Boolean(business && canRead && accountId),
  });
  const movementsQuery = useInfiniteQuery({
    ...cashMovementsInfiniteOptions(businessId, accountId),
    enabled: Boolean(business && canRead && accountId),
  });
  const movements = flattenPages(movementsQuery.data);
  const [selectedMovementId, setSelectedMovementId] = useState<string>();
  const [stage, setStage] = useState<"detail" | "archive-review">("detail");
  const [archiveCommand, setArchiveCommand] = useState<
    Parameters<typeof cashApi.accounts.archive>[1] | null
  >(null);

  const archiveMutation = useMutation({
    mutationFn: (command: Parameters<typeof cashApi.accounts.archive>[1]) => {
      if (!accountId) throw new Error("Cash account identifier is missing");
      return cashApi.accounts.archive(accountId, command);
    },
    onSuccess: async () => {
      if (!business) return;
      await invalidateCashLedger(queryClient, business.id);
      setStage("detail");
      setArchiveCommand(null);
    },
  });

  if (businesses.data && !business) return <Redirect href="/business" />;

  let remoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: cashUiCopy.offline,
    queries: [businesses, ...(canRead ? [accountQuery, movementsQuery] : [])],
    unavailableMessage: cashUiCopy.unavailable,
  });
  if (
    accountQuery.error instanceof ApiClientError &&
    accountQuery.error.code === "NOT_FOUND" &&
    !accountQuery.data
  ) {
    remoteState = { kind: "ready" };
  }
  const stale =
    accessIsStale || queryHasStaleData(accountQuery) || queryHasStaleData(movementsQuery);
  const account = accountQuery.data?.account ?? null;
  const selectedMovement = movements.find(({ id }) => id === selectedMovementId);

  if (selectedMovement && account && business) {
    return (
      <CashMovementDetailController
        accountName={account.name}
        businessId={business.id}
        canManage={canManage}
        isStale={stale}
        movement={selectedMovement}
        movements={movements}
        onBack={() => setSelectedMovementId(undefined)}
        timeZone={business.timeZone}
      />
    );
  }

  const retry = () => {
    void Promise.all([businesses.refetch(), accountQuery.refetch(), movementsQuery.refetch()]);
  };

  return (
    <CashAccountDetailScreen
      account={account}
      archiveCommand={archiveCommand}
      canManage={canManage && !stale}
      confirmation={cashConfirmationState(archiveMutation)}
      copy={cashAccountDetailCopy}
      errorMessage={archiveMutation.error ? cashErrorMessage(archiveMutation.error) : undefined}
      formatMoney={(minorUnits, currency, fractionDigits) =>
        formatMinorUnits(minorUnits, currency, fractionDigits, DEFAULT_LOCALE)
      }
      hasMoreMovements={Boolean(movementsQuery.hasNextPage)}
      isLoadingMoreMovements={movementsQuery.isFetchingNextPage}
      isStale={stale}
      movements={movements}
      onBeginArchive={() => {
        setArchiveCommand({ idempotencyKey: Crypto.randomUUID() });
        setStage("archive-review");
        archiveMutation.reset();
      }}
      onCancelArchive={() => {
        setStage("detail");
        setArchiveCommand(null);
        archiveMutation.reset();
      }}
      onCheckStatus={() => archiveCommand && archiveMutation.mutate(archiveCommand)}
      onConfirmArchive={() => archiveCommand && archiveMutation.mutate(archiveCommand)}
      onEditAccount={() =>
        accountId &&
        router.push({
          pathname: "/operate/cash/accounts/[accountId]/edit",
          params: { accountId },
        })
      }
      onLoadMoreMovements={() => void movementsQuery.fetchNextPage()}
      onOpenMovement={setSelectedMovementId}
      onRecordAdjustment={() =>
        router.push({ pathname: "/operate/cash/adjustments/new", params: { accountId } })
      }
      onRetry={retry}
      onTransfer={() =>
        router.push({
          pathname: "/operate/cash/transfers/new",
          params: { fromAccountId: accountId },
        })
      }
      remoteState={remoteState}
      stage={stage}
    />
  );
}
