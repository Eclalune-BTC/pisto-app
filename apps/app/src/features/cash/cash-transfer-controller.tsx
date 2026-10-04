import type { CashAccount, TransferCashRequest } from "@pisto/contracts";
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
import { requireSupportedLocale } from "@/i18n/locale";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { queryHasStaleData } from "@/lib/query-state";
import { cashApi } from "./api";
import { accountHref } from "./cash-account-list";
import {
  type CashTransferDraft,
  type CashTransferErrors,
  CashTransferScreen,
} from "./cash-transfer-screen";
import { cashBoundaryCopy, cashIssueMessages } from "./copy";
import { buildCashTransferCommand } from "./drafts";
import { invalidateCashLedger } from "./invalidate";
import { isLockedPhase, mutationPhase } from "./mutation-state";
import {
  activeCashAccountsInfiniteOptions,
  cashAccountQueryOptions,
  flattenPages,
} from "./queries";
import { featureRemoteState, refetchEnabled } from "./remote-state";
import { isRequestedAccountUnavailable, withRequestedAccount } from "./requested-account";
import { firstParam, type RouteParam } from "./search-params";
import { useCashAccess } from "./use-cash-access";

export function CashTransferController() {
  const params = useLocalSearchParams<{ fromAccountId?: RouteParam }>();
  const requestedFromId = firstParam(params.fromAccountId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const access = useCashAccess("cash");
  const { business, businesses, canRead } = access;
  const businessId = canRead ? business?.id : undefined;
  const accountsQuery = useInfiniteQuery(activeCashAccountsInfiniteOptions(businessId));
  const requestedAccount = useQuery(cashAccountQueryOptions(businessId, requestedFromId));
  const accounts = withRequestedAccount(
    flattenPages(accountsQuery.data),
    requestedAccount.data?.account,
  );
  const [draft, setDraft] = useState<CashTransferDraft>({
    amount: "",
    fromAccountId: requestedFromId ?? "",
    localDate: "",
    localTime: "",
    note: "",
    toAccountId: "",
  });
  const [errors, setErrors] = useState<CashTransferErrors>({});
  const [command, setCommand] = useState<TransferCashRequest | null>(null);
  const [reviewAccounts, setReviewAccounts] = useState<CashAccount[]>([]);

  useEffect(() => {
    if (!business) return;
    const now = currentLocalDateTime(business.timeZone);
    setDraft((value) => ({
      ...value,
      localDate: value.localDate || now.date,
      localTime: value.localTime || now.time,
    }));
  }, [business]);

  // Fill only empty choices once accounts exist; a choice the user made is never swapped, and a
  // same-account pair is reported by the review instead.
  const choiceIds = accounts.map(({ id }) => id).join(",");
  useEffect(() => {
    if (command || !choiceIds || (draft.fromAccountId && draft.toAccountId)) return;
    const ids = choiceIds.split(",");
    const from = draft.fromAccountId || ids[0] || "";
    const to = draft.toAccountId || (ids.find((id) => id !== from) ?? "");
    if (from !== draft.fromAccountId || to !== draft.toAccountId) {
      setDraft((value) => ({ ...value, fromAccountId: from, toAccountId: to }));
    }
  }, [choiceIds, command, draft.fromAccountId, draft.toAccountId]);

  const mutation = useMutation({
    mutationFn: cashApi.movements.transfer,
    onSuccess: async ({ transfer }) => {
      if (business) await invalidateCashLedger(queryClient, business.id);
      notify.success(t("cash.transfer.success"));
      router.replace(requestedFromId ? accountHref(transfer.fromAccountId) : "/operate/cash");
    },
  });
  const phase = mutationPhase(mutation);
  const locked = isLockedPhase(phase);

  if (businesses.data && !business) return <Redirect href="/business" />;

  const stale =
    access.isStale ||
    queryHasStaleData(accountsQuery) ||
    (Boolean(requestedFromId) && queryHasStaleData(requestedAccount));
  let state: FeatureRemoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: t("remote.offlineLoad"),
    queries: [businesses, accountsQuery, ...(requestedFromId ? [requestedAccount] : [])],
    unavailableMessage: t("cash.remote.unavailable"),
  });
  if (state.kind === "ready" && stale)
    state = { kind: "error", message: t("remote.staleMutation") };
  if (
    state.kind !== "denied" &&
    !command &&
    requestedFromId &&
    isRequestedAccountUnavailable(requestedAccount)
  ) {
    state = { kind: "error", message: t("cash.remote.requestedAccountUnavailable") };
  }
  state = requireFeatureManageAccess(state, access.canManage);
  const retry = () => void refetchEnabled([businesses, accountsQuery, requestedAccount]);

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
  const source = reviewAccounts.find(({ id }) => id === command?.fromAccountId);
  return (
    <CashTransferScreen
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
        if (!source) throw new Error("A cash transfer review requires its source account");
        return formatMinorUnits(minorUnits, currency, source.currencyMinorUnitDigits, locale);
      }}
      onCancel={() => {
        if (!locked) {
          router.replace(requestedFromId ? accountHref(requestedFromId) : "/operate/cash");
        }
      }}
      onConfirm={() => {
        if (command && (phase === "uncertain" || (phase !== "pending" && canConfirm))) {
          mutation.mutate(command);
        }
      }}
      onDraftChange={(next) => {
        if (!command) setDraft(next);
      }}
      onEdit={() => {
        if (locked) return;
        setCommand(null);
        setReviewAccounts([]);
        mutation.reset();
      }}
      onPrepareReview={() => {
        if (command || !canConfirm) return;
        const result = buildCashTransferCommand({
          accounts,
          draft,
          idempotencyKey: Crypto.randomUUID(),
        });
        setErrors(cashIssueMessages(t, result.issues));
        const prepared = result.command;
        if (!prepared) return;
        setReviewAccounts(
          accounts.filter(({ id }) => id === prepared.fromAccountId || id === prepared.toAccountId),
        );
        setCommand(prepared);
        mutation.reset();
      }}
      phase={phase}
      reviewAccounts={reviewAccounts}
    />
  );
}
