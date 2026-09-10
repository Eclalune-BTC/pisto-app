import type { CashAccount } from "@pisto/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { ApiClientError, isAmbiguousMutationError } from "@/lib/api-error";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { productErrorMessage } from "@/lib/product-errors";
import { cashApi } from "./api";
import {
  type CashTransferDraft,
  type CashTransferErrors,
  CashTransferScreen,
} from "./cash-transfer-screen";
import { buildCashCopy, cashIssueMessage } from "./copy";
import { buildCashTransferCommand } from "./drafts";
import { invalidateCashLedger } from "./invalidate";
import { cashConfirmationState } from "./mutation-state";
import {
  activeCashAccountsInfiniteOptions,
  cashAccountQueryOptions,
  flattenPages,
} from "./queries";
import { featureRemoteState, queryHasStaleData } from "./remote-state";
import { useCashAccess } from "./use-cash-access";

export function CashTransferController() {
  const params = useLocalSearchParams<{ fromAccountId?: string | string[] }>();
  const requestedFromAccount = Array.isArray(params.fromAccountId)
    ? params.fromAccountId[0]
    : params.fromAccountId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const copy = useMemo(() => buildCashCopy(t), [t]);
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const {
    business,
    businesses,
    canManage,
    canRead,
    isStale: accessIsStale,
  } = useCashAccess("cash");
  const businessId = business?.id ?? "unselected";
  const accountsQuery = useInfiniteQuery({
    ...activeCashAccountsInfiniteOptions(businessId),
    enabled: Boolean(business && canRead),
  });
  const requestedAccount = useQuery({
    ...cashAccountQueryOptions(businessId, requestedFromAccount ?? "missing"),
    enabled: Boolean(business && canRead && requestedFromAccount),
  });
  const listedAccounts = flattenPages(accountsQuery.data);
  const accounts = requestedAccount.data
    ? [
        requestedAccount.data.account,
        ...listedAccounts.filter(({ id }) => id !== requestedFromAccount),
      ]
    : listedAccounts;
  const [draft, setDraft] = useState<CashTransferDraft>({
    amount: "",
    fromAccountId: requestedFromAccount ?? "",
    localDate: "",
    localTime: "",
    note: "",
    toAccountId: "",
  });
  const [errors, setErrors] = useState<CashTransferErrors>({});
  const [command, setCommand] = useState<Parameters<typeof cashApi.movements.transfer>[0] | null>(
    null,
  );
  const [reviewAccounts, setReviewAccounts] = useState<CashAccount[]>([]);

  useEffect(() => {
    if (!business) return;
    const current = currentLocalDateTime(business.timeZone);
    setDraft((value) => ({
      ...value,
      localDate: value.localDate || current.date,
      localTime: value.localTime || current.time,
    }));
  }, [business]);

  useEffect(() => {
    if (command) return;
    const first = accounts[0];
    if (!first) return;
    const from = draft.fromAccountId || first.id;
    const to = accounts.some(({ id }) => id === draft.toAccountId && id !== from)
      ? draft.toAccountId
      : (accounts.find(({ id }) => id !== from)?.id ?? "");
    if (from !== draft.fromAccountId || to !== draft.toAccountId) {
      setDraft((value) => ({ ...value, fromAccountId: from, toAccountId: to }));
    }
  }, [accounts, draft.fromAccountId, draft.toAccountId, command]);

  const mutation = useMutation({
    mutationFn: cashApi.movements.transfer,
    onSuccess: async () => {
      if (!business) return;
      await invalidateCashLedger(queryClient, business.id);
      router.replace("/operate/cash");
    },
  });
  const confirmationLocked = mutation.isPending || isAmbiguousMutationError(mutation.error);

  if (businesses.data && !business) return <Redirect href="/business" />;
  let remoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: copy.remote.offline,
    queries: [
      businesses,
      ...(canRead ? [accountsQuery, ...(requestedFromAccount ? [requestedAccount] : [])] : []),
    ],
    unavailableMessage: copy.remote.unavailable,
  });
  const stale =
    accessIsStale ||
    queryHasStaleData(accountsQuery) ||
    (Boolean(requestedFromAccount) && queryHasStaleData(requestedAccount));
  if (remoteState.kind === "ready" && stale) {
    remoteState = { kind: "error", message: copy.remote.staleMutation };
  }
  if (
    remoteState.kind !== "denied" &&
    !command &&
    requestedFromAccount &&
    (requestedAccount.data?.account.status === "archived" ||
      (requestedAccount.error instanceof ApiClientError &&
        requestedAccount.error.code === "NOT_FOUND"))
  ) {
    remoteState = { kind: "error", message: copy.remote.requestedAccountUnavailable };
  }

  const prepareReview = () => {
    if (confirmationLocked || command || !canManage || stale || remoteState.kind !== "ready")
      return;
    const result = buildCashTransferCommand({
      accounts,
      draft,
      idempotencyKey: Crypto.randomUUID(),
    });
    setErrors(
      Object.fromEntries(
        Object.entries(result.issues).map(([field, issue]) => [field, cashIssueMessage(t, issue)]),
      ) as CashTransferErrors,
    );
    if (!result.command) return;
    setReviewAccounts(
      accounts.filter(
        ({ id }) => id === result.command?.fromAccountId || id === result.command?.toAccountId,
      ),
    );
    setCommand(result.command);
    mutation.reset();
  };
  const confirm = () => {
    if (command && !mutation.isPending && canManage && !stale && remoteState.kind === "ready")
      mutation.mutate(command);
  };

  const selectedAccount = reviewAccounts.find(({ id }) => id === command?.fromAccountId);
  return (
    <CashTransferScreen
      accounts={accounts}
      canManage={canManage && !stale}
      command={command}
      confirmation={cashConfirmationState(mutation)}
      copy={copy.transfer}
      draft={draft}
      effect={copy.effects.transfer}
      errorMessage={
        mutation.error
          ? productErrorMessage(mutation.error, copy.remote.mutationFallback, t)
          : undefined
      }
      errors={errors}
      formatMoney={(minorUnits, currency) =>
        formatMinorUnits(
          minorUnits,
          currency,
          selectedAccount?.currencyMinorUnitDigits ?? business?.currencyMinorUnitDigits ?? 2,
          locale,
        )
      }
      hasMoreAccounts={Boolean(accountsQuery.hasNextPage)}
      isLoadingMoreAccounts={accountsQuery.isFetchingNextPage}
      onCancel={() => {
        if (!confirmationLocked) router.replace("/operate/cash");
      }}
      onCheckStatus={confirm}
      onConfirm={confirm}
      onCreateAccount={() => router.push("/operate/cash/accounts/new")}
      onDraftChange={(next) => {
        if (!confirmationLocked && !command) setDraft(next);
      }}
      onEdit={() => {
        if (confirmationLocked) return;
        setCommand(null);
        setReviewAccounts([]);
        mutation.reset();
      }}
      onLoadMoreAccounts={() => void accountsQuery.fetchNextPage()}
      onPrepareReview={prepareReview}
      onRetry={() =>
        void Promise.all([
          businesses.refetch(),
          accountsQuery.refetch(),
          ...(requestedFromAccount ? [requestedAccount.refetch()] : []),
        ])
      }
      remoteState={remoteState}
      reviewAccounts={reviewAccounts}
      stage={command ? "review" : "edit"}
    />
  );
}
