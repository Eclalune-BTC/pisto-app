import type { ArchiveCashAccountRequest, CashMovement } from "@pisto/contracts";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { focusReturnTarget } from "@/lib/focus-return";
import { useKeyedCommand } from "@/lib/keyed-command";
import { formatMinorUnits } from "@/lib/money";
import { notify } from "@/lib/notify";
import { flattenPages } from "@/lib/pages";
import { productErrorMessage } from "@/lib/product-errors";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";
import { firstParam, type RouteParam } from "@/lib/route-params";
import { cashApi } from "./api";
import { CashAccountDetailScreen } from "./cash-account-detail-screen";
import { CashMovementDetail } from "./cash-movement-detail-controller";
import { cashBoundaryCopy } from "./copy";
import { invalidateCashLedger } from "./invalidate";
import { cashAccountQueryOptions, cashMovementsInfiniteOptions } from "./queries";
import { featureRemoteState, refetchEnabled } from "./remote-state";
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
    returnFocus: HTMLElement | null;
  }>();
  const [archiving, setArchiving] = useState(false);
  // Kept after the dialog closes: focus returns to the opener once the dialog has unmounted.
  const [archiveOpener, setArchiveOpener] = useState<HTMLElement | null>(null);
  const archive = useKeyedCommand({
    mutationFn: (command: ArchiveCashAccountRequest) => {
      if (!accountId) throw new Error("Cash account identifier is missing");
      return cashApi.accounts.archive(accountId, command);
    },
    onConfirmed: async () => {
      if (business) await invalidateCashLedger(queryClient, business.id);
      notify.success(t("cash.archive.success"));
      setArchiving(false);
    },
  });
  const account = accountQuery.data?.account;
  useRouteLabel("/operate/cash/accounts/[accountId]", account?.name);

  if (businesses.data && !business) return <Redirect href="/business" />;

  const retry = () => {
    void refetchEnabled([businesses, accountQuery, movementsQuery]);
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
  const archivePhase = archive.phase;
  const selected =
    selection?.businessId === business.id && selection.accountId === account.id
      ? selection
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
            if (archivePhase === "pending") return;
            // The same command may always be sent again; only a first attempt needs fresh access.
            if (archivePhase === "uncertain" && archive.variables) {
              archive.send(archive.variables);
              return;
            }
            if (!canManage) return;
            // The command has no reviewable fields; every attempt in one dialog is the same command.
            archive.send(archive.variables ?? { idempotencyKey: Crypto.randomUUID() });
          },
          onOpen: () => {
            archive.reset();
            setArchiveOpener(focusReturnTarget());
            setArchiving(true);
          },
          open: archiving,
          phase: archivePhase,
          returnFocus: archiveOpener,
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
          if (movement) {
            setSelection({
              accountId: account.id,
              businessId: business.id,
              movement,
              returnFocus: focusReturnTarget(),
            });
          }
        }}
        onRetry={retry}
      />
      {selected ? (
        <CashMovementDetail
          accountName={account.name}
          businessId={business.id}
          canManage={canManage}
          key={selected.movement.id}
          movement={selected.movement}
          movements={movements}
          onClose={() => setSelection(undefined)}
          returnFocus={selected.returnFocus}
          timeZone={business.timeZone}
        />
      ) : null}
    </>
  );
}
