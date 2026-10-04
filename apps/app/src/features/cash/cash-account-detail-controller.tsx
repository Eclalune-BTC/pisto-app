import type { ArchiveCashAccountRequest, CashMovement } from "@pisto/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams } from "expo-router";
import { SearchX } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FeatureBoundary } from "@/components/feature-boundary";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { useRouteLabel } from "@/components/shell/shell-context";
import { StatePanel } from "@/components/ui/state-panel";
import { formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { ApiClientError } from "@/lib/api-error";
import { formatMinorUnits } from "@/lib/money";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";
import { cashApi } from "./api";
import { CashAccountDetailScreen } from "./cash-account-detail-screen";
import { CashMovementDetail } from "./cash-movement-detail-controller";
import { cashBoundaryCopy } from "./copy";
import { invalidateCashLedger } from "./invalidate";
import { mutationPhase } from "./mutation-state";
import { cashAccountQueryOptions, cashMovementsInfiniteOptions, flattenPages } from "./queries";
import { featureRemoteState } from "./remote-state";
import { firstParam, type RouteParam } from "./search-params";
import { useCashAccess } from "./use-cash-access";

export function CashAccountDetailController() {
  const params = useLocalSearchParams<{ accountId?: RouteParam }>();
  const accountId = firstParam(params.accountId);
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const access = useCashAccess("cash");
  const { business, businesses, canRead } = access;
  const businessId = canRead ? business?.id : undefined;
  const accountQuery = useQuery(cashAccountQueryOptions(businessId, accountId));
  const movementsQuery = useInfiniteQuery(
    cashMovementsInfiniteOptions(accountId ? businessId : undefined, accountId),
  );
  const [selection, setSelection] = useState<{
    accountId: string;
    businessId: string;
    movement: CashMovement;
  }>();
  const [archiving, setArchiving] = useState(false);
  const archive = useMutation({
    mutationFn: (command: ArchiveCashAccountRequest) => {
      if (!accountId) throw new Error("Cash account identifier is missing");
      return cashApi.accounts.archive(accountId, command);
    },
    onSuccess: async () => {
      if (business) await invalidateCashLedger(queryClient, business.id);
      notify.success(t("cash.archive.success"));
      setArchiving(false);
    },
  });
  const account = accountQuery.data?.account;
  useRouteLabel("/operate/cash/accounts/[accountId]", account?.name);

  if (businesses.data && !business) return <Redirect href="/business" />;

  const retry = () => {
    void Promise.all([businesses.refetch(), accountQuery.refetch(), movementsQuery.refetch()]);
  };
  const notFound =
    !accountId ||
    (accountQuery.error instanceof ApiClientError &&
      accountQuery.error.code === "NOT_FOUND" &&
      !account);
  const messages = {
    offlineMessage: t("remote.offlineLoad"),
    unavailableMessage: t("cash.remote.unavailable"),
  };
  const pageState = hasDeniedRead([accountQuery, movementsQuery])
    ? ({ kind: "denied" } as const)
    : featureRemoteState({
        ...messages,
        businessPending: businesses.isPending,
        canRead,
        queries: notFound ? [businesses] : [businesses, accountQuery],
      });
  if (pageState.kind === "loading") {
    return (
      <Page>
        <ContentSkeleton label={t("cash.boundary.loading")} variant="detail" />
      </Page>
    );
  }
  if (pageState.kind !== "ready") {
    return (
      <FeatureBoundary copy={cashBoundaryCopy(t)} onRetry={retry} state={pageState}>
        {null}
      </FeatureBoundary>
    );
  }
  if (notFound || !account) {
    return (
      <Page>
        <StatePanel
          description={t("cash.accountDetail.notFoundDescription")}
          icon={SearchX}
          level={1}
          title={t("cash.accountDetail.notFoundTitle")}
        />
      </Page>
    );
  }
  if (!business) throw new Error("A readable cash account requires the active business");

  const stale =
    access.isStale || queryHasStaleData(accountQuery) || queryHasStaleData(movementsQuery);
  const canManage = access.canManage && !stale;
  const movements = flattenPages(movementsQuery.data);
  const archivePhase = mutationPhase(archive);
  const selected =
    selection?.businessId === business.id && selection.accountId === account.id
      ? selection.movement
      : undefined;

  return (
    <>
      <CashAccountDetailScreen
        account={account}
        archive={{
          errorMessage: archive.error
            ? productErrorMessage(archive.error, t("cash.remote.mutationFallback"), t)
            : undefined,
          onCancel: () => {
            setArchiving(false);
            archive.reset();
          },
          onConfirm: () => {
            if (!canManage || archivePhase === "pending") return;
            // The command has no reviewable fields; every attempt in one dialog is the same command.
            archive.mutate(archive.variables ?? { idempotencyKey: Crypto.randomUUID() });
          },
          onOpen: () => {
            archive.reset();
            setArchiving(true);
          },
          open: archiving,
          phase: archivePhase,
        }}
        canManage={canManage}
        formatMoney={(minorUnits, currency, fractionDigits) =>
          formatMinorUnits(minorUnits, currency, fractionDigits, locale)
        }
        formatOccurredAt={(movement) =>
          formatLocalizedDateTime(movement.occurredAt, locale, movement.timeZone)
        }
        formatTimestamp={(timestamp) =>
          formatLocalizedDateTime(timestamp, locale, business.timeZone)
        }
        isStale={stale}
        movements={movements}
        movementsPage={{
          hasMore: movementsQuery.hasNextPage,
          loadingMore: movementsQuery.isFetchingNextPage,
          onLoadMore: () => void movementsQuery.fetchNextPage(),
        }}
        movementsState={featureRemoteState({
          ...messages,
          businessPending: false,
          canRead: true,
          queries: [movementsQuery],
        })}
        onOpenMovement={(movementId) => {
          const movement = movements.find(({ id }) => id === movementId);
          if (movement) setSelection({ accountId: account.id, businessId: business.id, movement });
        }}
        onRetry={retry}
      />
      {selected ? (
        <CashMovementDetail
          accountName={account.name}
          businessId={business.id}
          canManage={canManage}
          key={selected.id}
          movement={selected}
          movements={movements}
          onClose={() => setSelection(undefined)}
          timeZone={business.timeZone}
        />
      ) : null}
    </>
  );
}
