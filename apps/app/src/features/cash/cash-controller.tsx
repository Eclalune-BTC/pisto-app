import type { CashMovement } from "@pisto/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FeatureBoundary } from "@/components/feature-boundary";
import { formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";
import { CashMovementDetail } from "./cash-movement-detail-controller";
import { CashScreen } from "./cash-screen";
import { cashBoundaryCopy } from "./copy";
import { cashAccountsInfiniteOptions, cashMovementsInfiniteOptions, flattenPages } from "./queries";
import { featureRemoteState } from "./remote-state";
import { accountStatusParam, parseAccountStatus, type RouteParam } from "./search-params";
import { useCashAccess } from "./use-cash-access";

export function CashController() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: RouteParam }>();
  const accountStatus = parseAccountStatus(params.status);
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const access = useCashAccess("cash");
  const { business, businesses, canRead } = access;
  const businessId = canRead ? business?.id : undefined;
  const accounts = useInfiniteQuery(cashAccountsInfiniteOptions(businessId, accountStatus));
  const movements = useInfiniteQuery(cashMovementsInfiniteOptions(businessId));
  const [selection, setSelection] = useState<{ businessId: string; movement: CashMovement }>();

  if (businesses.data && !business) return <Redirect href="/business" />;

  const messages = {
    offlineMessage: t("remote.offlineLoad"),
    unavailableMessage: t("cash.remote.unavailable"),
  };
  const retry = () => {
    void Promise.all([businesses.refetch(), accounts.refetch(), movements.refetch()]);
  };
  // A rejected ledger read is authoritative even when the business list is still cached.
  const pageState = hasDeniedRead([accounts, movements])
    ? ({ kind: "denied" } as const)
    : featureRemoteState({
        ...messages,
        businessPending: businesses.isPending,
        canRead,
        queries: [businesses],
      });
  if (pageState.kind !== "ready") {
    return (
      <FeatureBoundary copy={cashBoundaryCopy(t)} onRetry={retry} state={pageState}>
        {null}
      </FeatureBoundary>
    );
  }
  if (!business) throw new Error("A readable cash page requires the active business");

  const sectionState = (query: typeof accounts | typeof movements) =>
    featureRemoteState({ ...messages, businessPending: false, canRead: true, queries: [query] });
  const stale = access.isStale || queryHasStaleData(accounts) || queryHasStaleData(movements);
  const canManage = access.canManage && !stale;
  const accountItems = flattenPages(accounts.data);
  const movementItems = flattenPages(movements.data);
  const accountNames = new Map(accountItems.map(({ id, name }) => [id, name]));
  const selected = selection?.businessId === business.id ? selection.movement : undefined;

  return (
    <>
      <CashScreen
        accountNames={accountNames}
        accountStatus={accountStatus}
        accounts={accountItems}
        accountsPage={{
          hasMore: accounts.hasNextPage,
          loadingMore: accounts.isFetchingNextPage,
          onLoadMore: () => void accounts.fetchNextPage(),
        }}
        accountsState={sectionState(accounts)}
        businessId={business.id}
        canManage={canManage}
        formatMoney={(minorUnits, currency, fractionDigits) =>
          formatMinorUnits(minorUnits, currency, fractionDigits, locale)
        }
        formatOccurredAt={(movement) =>
          formatLocalizedDateTime(movement.occurredAt, locale, movement.timeZone)
        }
        isStale={stale}
        movements={movementItems}
        movementsPage={{
          hasMore: movements.hasNextPage,
          loadingMore: movements.isFetchingNextPage,
          onLoadMore: () => void movements.fetchNextPage(),
        }}
        movementsState={sectionState(movements)}
        onAccountStatusChange={(status) => router.setParams({ status: accountStatusParam(status) })}
        onOpenMovement={(movementId) => {
          const movement = movementItems.find(({ id }) => id === movementId);
          if (movement) setSelection({ businessId: business.id, movement });
        }}
        onRetry={retry}
      />
      {selected ? (
        <CashMovementDetail
          accountName={accountNames.get(selected.accountId)}
          businessId={business.id}
          canManage={canManage}
          key={selected.id}
          movement={selected}
          movements={movementItems}
          onClose={() => setSelection(undefined)}
          timeZone={business.timeZone}
        />
      ) : null}
    </>
  );
}
