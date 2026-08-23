import type { CashAccountStatus } from "@pisto/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
import { CashScreen, type CashScreenState } from "./cash-screen";
import { cashOverviewCopy, cashUiCopy } from "./copy";
import { cashAccountsInfiniteOptions, cashMovementsInfiniteOptions, flattenPages } from "./queries";
import { featureRemoteState, queryHasStaleData } from "./remote-state";
import { useCashAccess } from "./use-cash-access";

export function CashController() {
  const router = useRouter();
  const {
    business,
    businesses,
    canManage,
    canRead,
    isStale: accessIsStale,
  } = useCashAccess("cash");
  const [accountStatus, setAccountStatus] = useState<CashAccountStatus | "all">("active");
  const businessId = business?.id ?? "unselected";
  const accounts = useInfiniteQuery({
    ...cashAccountsInfiniteOptions(businessId, accountStatus),
    enabled: Boolean(business && canRead),
  });
  const movements = useInfiniteQuery({
    ...cashMovementsInfiniteOptions(businessId),
    enabled: Boolean(business && canRead),
  });

  if (businesses.data && !business) return <Redirect href="/business" />;

  const remoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: cashUiCopy.offline,
    queries: [businesses, ...(canRead ? [accounts, movements] : [])],
    unavailableMessage: cashUiCopy.unavailable,
  });
  const stale = accessIsStale || queryHasStaleData(accounts) || queryHasStaleData(movements);
  const state: CashScreenState =
    remoteState.kind === "ready"
      ? {
          accounts: flattenPages(accounts.data),
          canManage: canManage && !stale,
          confirmation: "idle",
          isStale: stale,
          kind: "ready",
          movements: flattenPages(movements.data),
        }
      : remoteState;
  const retry = () => {
    void Promise.all([businesses.refetch(), accounts.refetch(), movements.refetch()]);
  };

  return (
    <CashScreen
      accountStatus={accountStatus}
      copy={cashOverviewCopy(business?.name ?? "este negocio")}
      formatMoney={(minorUnits, currency, fractionDigits) =>
        formatMinorUnits(minorUnits, currency, fractionDigits, DEFAULT_LOCALE)
      }
      hasMoreAccounts={Boolean(accounts.hasNextPage)}
      hasMoreMovements={Boolean(movements.hasNextPage)}
      isLoadingMoreAccounts={accounts.isFetchingNextPage}
      isLoadingMoreMovements={movements.isFetchingNextPage}
      onAccountStatusChange={setAccountStatus}
      onCheckMutationStatus={retry}
      onCreateAccount={() => router.push("/operate/cash/accounts/new")}
      onLoadMoreAccounts={() => void accounts.fetchNextPage()}
      onLoadMoreMovements={() => void movements.fetchNextPage()}
      onOpenAccount={(accountId) =>
        router.push({ pathname: "/operate/cash/accounts/[accountId]", params: { accountId } })
      }
      onRetry={retry}
      state={state}
    />
  );
}
