import type { CashAccount, RecordCashAdjustmentRequest } from "@pisto/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FeatureBoundary,
  type FeatureRemoteState,
  requireFeatureManageAccess,
} from "@/components/feature-boundary";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { useRouteLabel } from "@/components/shell/shell-context";
import { requireSupportedLocale } from "@/i18n/locale";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { queryHasStaleData } from "@/lib/query-state";
import { cashApi } from "./api";
import { accountHref } from "./cash-account-list";
import {
  type CashAdjustmentDraft,
  type CashAdjustmentErrors,
  CashAdjustmentScreen,
} from "./cash-adjustment-screen";
import { cashBoundaryCopy, cashIssueMessages } from "./copy";
import { buildCashAdjustmentCommand } from "./drafts";
import { invalidateCashLedger } from "./invalidate";
import { isLockedPhase, mutationPhase } from "./mutation-state";
import {
  activeCashAccountsInfiniteOptions,
  cashAccountQueryOptions,
  flattenPages,
} from "./queries";
import { featureRemoteState } from "./remote-state";
import { isRequestedAccountUnavailable, withRequestedAccount } from "./requested-account";
import { firstParam, type RouteParam } from "./search-params";
import { useCashAccess } from "./use-cash-access";

export function CashAdjustmentController() {
  const params = useLocalSearchParams<{ accountId?: RouteParam }>();
  const requestedAccountId = firstParam(params.accountId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const access = useCashAccess("cash");
  const { business, businesses, canRead } = access;
  const businessId = canRead ? business?.id : undefined;
  const accountsQuery = useInfiniteQuery(activeCashAccountsInfiniteOptions(businessId));
  const requestedAccount = useQuery(cashAccountQueryOptions(businessId, requestedAccountId));
  const accounts = withRequestedAccount(
    flattenPages(accountsQuery.data),
    requestedAccount.data?.account,
  );
  const [draft, setDraft] = useState<CashAdjustmentDraft>({
    accountId: requestedAccountId ?? "",
    amount: "",
    direction: "in",
    localDate: "",
    localTime: "",
    reason: "",
  });
  const [errors, setErrors] = useState<CashAdjustmentErrors>({});
  const [command, setCommand] = useState<RecordCashAdjustmentRequest | null>(null);
  const [reviewAccount, setReviewAccount] = useState<CashAccount | null>(null);
  useRouteLabel("/operate/cash/accounts/[accountId]", requestedAccount.data?.account.name);

  useEffect(() => {
    if (!business) return;
    const now = currentLocalDateTime(business.timeZone);
    setDraft((value) => ({
      ...value,
      localDate: value.localDate || now.date,
      localTime: value.localTime || now.time,
    }));
  }, [business]);

  const firstAccountId = accounts[0]?.id;
  useEffect(() => {
    if (command || draft.accountId || !firstAccountId) return;
    setDraft((value) => ({ ...value, accountId: firstAccountId }));
  }, [command, draft.accountId, firstAccountId]);

  const mutation = useMutation({
    mutationFn: cashApi.movements.recordAdjustment,
    onSuccess: async ({ movement }) => {
      if (business) await invalidateCashLedger(queryClient, business.id);
      notify.success(t("cash.adjustment.success"));
      router.replace(accountHref(movement.accountId));
    },
  });
  const phase = mutationPhase(mutation);
  const locked = isLockedPhase(phase);

  if (businesses.data && !business) return <Redirect href="/business" />;

  const stale =
    access.isStale ||
    queryHasStaleData(accountsQuery) ||
    (Boolean(requestedAccountId) && queryHasStaleData(requestedAccount));
  let state: FeatureRemoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: t("remote.offlineLoad"),
    queries: [businesses, accountsQuery, ...(requestedAccountId ? [requestedAccount] : [])],
    unavailableMessage: t("cash.remote.unavailable"),
  });
  if (state.kind === "ready" && stale)
    state = { kind: "error", message: t("remote.staleMutation") };
  // A reviewed command keeps its snapshot; only a new draft is refused for a vanished account.
  if (
    state.kind !== "denied" &&
    !command &&
    requestedAccountId &&
    isRequestedAccountUnavailable(requestedAccount)
  ) {
    state = { kind: "error", message: t("cash.remote.requestedAccountUnavailable") };
  }
  state = requireFeatureManageAccess(state, access.canManage);
  const retry = () =>
    void Promise.all([
      businesses.refetch(),
      accountsQuery.refetch(),
      ...(requestedAccountId ? [requestedAccount.refetch()] : []),
    ]);

  if (state.kind === "loading") {
    return (
      <Page width="form">
        <ContentSkeleton label={t("cash.boundary.loading")} variant="form" />
      </Page>
    );
  }
  if (state.kind !== "ready") {
    return (
      <FeatureBoundary copy={cashBoundaryCopy(t)} onRetry={retry} state={state}>
        {null}
      </FeatureBoundary>
    );
  }

  const canConfirm = access.canManage && !stale;
  return (
    <CashAdjustmentScreen
      accounts={accounts}
      accountsPage={{
        hasMore: accountsQuery.hasNextPage,
        loadingMore: accountsQuery.isFetchingNextPage,
        onLoadMore: () => void accountsQuery.fetchNextPage(),
      }}
      canConfirm={canConfirm}
      command={command}
      draft={draft}
      errorMessage={
        mutation.error
          ? productErrorMessage(mutation.error, t("cash.remote.mutationFallback"), t)
          : undefined
      }
      errors={errors}
      formatMoney={(minorUnits, currency) => {
        if (!reviewAccount) throw new Error("A cash adjustment review requires its account");
        return formatMinorUnits(
          minorUnits,
          currency,
          reviewAccount.currencyMinorUnitDigits,
          locale,
        );
      }}
      onCancel={() => {
        if (!locked) {
          router.replace(requestedAccountId ? accountHref(requestedAccountId) : "/operate/cash");
        }
      }}
      onConfirm={() => {
        if (command && phase !== "pending" && canConfirm) mutation.mutate(command);
      }}
      onDraftChange={(next) => {
        if (!command) setDraft(next);
      }}
      onEdit={() => {
        if (locked) return;
        setCommand(null);
        setReviewAccount(null);
        mutation.reset();
      }}
      onPrepareReview={() => {
        if (command || !canConfirm) return;
        const account = accounts.find(({ id }) => id === draft.accountId);
        const result = buildCashAdjustmentCommand({
          account,
          draft,
          idempotencyKey: Crypto.randomUUID(),
        });
        setErrors(cashIssueMessages(t, result.issues));
        if (!result.command || !account) return;
        setReviewAccount(account);
        setCommand(result.command);
        mutation.reset();
      }}
      phase={phase}
      reviewAccount={reviewAccount}
    />
  );
}
