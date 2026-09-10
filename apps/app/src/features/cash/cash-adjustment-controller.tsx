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
import { queryHasStaleData } from "@/lib/query-state";
import { cashApi } from "./api";
import {
  type CashAdjustmentDraft,
  type CashAdjustmentErrors,
  CashAdjustmentScreen,
} from "./cash-adjustment-screen";
import { buildCashCopy, cashIssueMessage } from "./copy";
import { buildCashAdjustmentCommand } from "./drafts";
import { invalidateCashLedger } from "./invalidate";
import { cashConfirmationState } from "./mutation-state";
import {
  activeCashAccountsInfiniteOptions,
  cashAccountQueryOptions,
  flattenPages,
} from "./queries";
import { featureRemoteState } from "./remote-state";
import { useCashAccess } from "./use-cash-access";

export function CashAdjustmentController() {
  const params = useLocalSearchParams<{ accountId?: string | string[] }>();
  const initialAccountId = Array.isArray(params.accountId) ? params.accountId[0] : params.accountId;
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
    ...cashAccountQueryOptions(businessId, initialAccountId ?? "missing"),
    enabled: Boolean(business && canRead && initialAccountId),
  });
  const listedAccounts = flattenPages(accountsQuery.data);
  const accounts = requestedAccount.data
    ? [requestedAccount.data.account, ...listedAccounts.filter(({ id }) => id !== initialAccountId)]
    : listedAccounts;
  const [draft, setDraft] = useState<CashAdjustmentDraft>({
    accountId: initialAccountId ?? "",
    amount: "",
    direction: "in",
    localDate: "",
    localTime: "",
    reason: "",
  });
  const [errors, setErrors] = useState<CashAdjustmentErrors>({});
  const [command, setCommand] = useState<
    Parameters<typeof cashApi.movements.recordAdjustment>[0] | null
  >(null);
  const [reviewAccount, setReviewAccount] = useState<CashAccount | null>(null);

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
    if (command || draft.accountId) return;
    const firstAccount = accounts[0];
    if (firstAccount) {
      setDraft((value) => ({ ...value, accountId: firstAccount.id }));
    }
  }, [accounts, draft.accountId, command]);

  const mutation = useMutation({
    mutationFn: cashApi.movements.recordAdjustment,
    onSuccess: async ({ movement }) => {
      if (!business) return;
      await invalidateCashLedger(queryClient, business.id);
      router.replace({
        pathname: "/operate/cash/accounts/[accountId]",
        params: { accountId: movement.accountId },
      });
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
      ...(canRead ? [accountsQuery, ...(initialAccountId ? [requestedAccount] : [])] : []),
    ],
    unavailableMessage: copy.remote.unavailable,
  });
  const stale =
    accessIsStale ||
    queryHasStaleData(accountsQuery) ||
    (Boolean(initialAccountId) && queryHasStaleData(requestedAccount));
  if (remoteState.kind === "ready" && stale) {
    remoteState = { kind: "error", message: copy.remote.staleMutation };
  }
  if (
    remoteState.kind !== "denied" &&
    !command &&
    initialAccountId &&
    (requestedAccount.data?.account.status === "archived" ||
      (requestedAccount.error instanceof ApiClientError &&
        requestedAccount.error.code === "NOT_FOUND"))
  ) {
    remoteState = { kind: "error", message: copy.remote.requestedAccountUnavailable };
  }

  const prepareReview = () => {
    if (confirmationLocked || command || !canManage || stale || remoteState.kind !== "ready")
      return;
    const account = accounts.find(({ id }) => id === draft.accountId);
    const result = buildCashAdjustmentCommand({
      account,
      draft,
      idempotencyKey: Crypto.randomUUID(),
    });
    setErrors(
      Object.fromEntries(
        Object.entries(result.issues).map(([field, issue]) => [field, cashIssueMessage(t, issue)]),
      ) as CashAdjustmentErrors,
    );
    if (!result.command || !account) return;
    setReviewAccount(account);
    setCommand(result.command);
    mutation.reset();
  };
  const confirm = () => {
    if (command && !mutation.isPending && canManage && !stale && remoteState.kind === "ready")
      mutation.mutate(command);
  };

  return (
    <CashAdjustmentScreen
      accounts={accounts}
      canManage={canManage && !stale}
      command={command}
      confirmation={cashConfirmationState(mutation)}
      copy={copy.adjustment}
      draft={draft}
      effect={copy.effects.adjustment}
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
          reviewAccount?.currencyMinorUnitDigits ?? business?.currencyMinorUnitDigits ?? 2,
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
        setReviewAccount(null);
        mutation.reset();
      }}
      onLoadMoreAccounts={() => void accountsQuery.fetchNextPage()}
      onPrepareReview={prepareReview}
      onRetry={() =>
        void Promise.all([
          businesses.refetch(),
          accountsQuery.refetch(),
          ...(initialAccountId ? [requestedAccount.refetch()] : []),
        ])
      }
      remoteState={remoteState}
      reviewAccount={reviewAccount}
      stage={command ? "review" : "edit"}
    />
  );
}
