import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { currentLocalDateTime } from "@/lib/money";
import { cashApi } from "./api";
import {
  type CashTransferDraft,
  type CashTransferErrors,
  CashTransferScreen,
} from "./cash-transfer-screen";
import { cashErrorMessage, cashIssueMessage, cashTransferCopy, cashUiCopy } from "./copy";
import { buildCashTransferCommand } from "./drafts";
import { formatCashMinorUnits } from "./format";
import { invalidateCashLedger } from "./invalidate";
import { cashConfirmationState } from "./mutation-state";
import { activeCashAccountsInfiniteOptions, flattenPages } from "./queries";
import { featureRemoteState, queryHasStaleData } from "./remote-state";
import { useCashAccess } from "./use-cash-access";

export function CashTransferController() {
  const params = useLocalSearchParams<{ fromAccountId?: string | string[] }>();
  const requestedFromAccount = Array.isArray(params.fromAccountId)
    ? params.fromAccountId[0]
    : params.fromAccountId;
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
  const accountsQuery = useInfiniteQuery({
    ...activeCashAccountsInfiniteOptions(businessId),
    enabled: Boolean(business && canRead),
  });
  const accounts = flattenPages(accountsQuery.data);
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
    const first = accounts[0];
    if (!first) return;
    const from = accounts.some(({ id }) => id === draft.fromAccountId)
      ? draft.fromAccountId
      : first.id;
    const to = accounts.some(({ id }) => id === draft.toAccountId && id !== from)
      ? draft.toAccountId
      : (accounts.find(({ id }) => id !== from)?.id ?? "");
    if (from !== draft.fromAccountId || to !== draft.toAccountId) {
      setDraft((value) => ({ ...value, fromAccountId: from, toAccountId: to }));
    }
  }, [accounts, draft.fromAccountId, draft.toAccountId]);

  const mutation = useMutation({
    mutationFn: cashApi.movements.transfer,
    onSuccess: async () => {
      if (!business) return;
      await invalidateCashLedger(queryClient, business.id);
      router.replace("/operate/cash");
    },
  });

  if (businesses.data && !business) return <Redirect href="/business" />;
  let remoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: cashUiCopy.offline,
    queries: [businesses, ...(canRead ? [accountsQuery] : [])],
    unavailableMessage: cashUiCopy.unavailable,
  });
  const stale = accessIsStale || queryHasStaleData(accountsQuery);
  if (remoteState.kind === "ready" && stale) {
    remoteState = { kind: "error", message: cashUiCopy.staleMutation };
  }

  const prepareReview = () => {
    const result = buildCashTransferCommand({
      accounts,
      draft,
      idempotencyKey: Crypto.randomUUID(),
    });
    setErrors(
      Object.fromEntries(
        Object.entries(result.issues).map(([field, issue]) => [field, cashIssueMessage(issue)]),
      ) as CashTransferErrors,
    );
    if (!result.command) return;
    setCommand(result.command);
    mutation.reset();
  };

  const selectedAccount = accounts.find(({ id }) => id === command?.fromAccountId);
  return (
    <CashTransferScreen
      accounts={accounts}
      canManage={canManage && !stale}
      command={command}
      confirmation={cashConfirmationState(mutation)}
      copy={cashTransferCopy}
      draft={draft}
      effect={cashUiCopy.transferEffect}
      errorMessage={mutation.error ? cashErrorMessage(mutation.error) : undefined}
      errors={errors}
      formatMoney={(minorUnits, currency) =>
        formatCashMinorUnits(
          minorUnits,
          currency,
          selectedAccount?.currencyMinorUnitDigits ?? business?.currencyMinorUnitDigits ?? 2,
          DEFAULT_LOCALE,
        )
      }
      hasMoreAccounts={Boolean(accountsQuery.hasNextPage)}
      isLoadingMoreAccounts={accountsQuery.isFetchingNextPage}
      onCancel={() => router.replace("/operate/cash")}
      onCheckStatus={() => command && mutation.mutate(command)}
      onConfirm={() => command && mutation.mutate(command)}
      onCreateAccount={() => router.push("/operate/cash/accounts/new")}
      onDraftChange={setDraft}
      onEdit={() => {
        setCommand(null);
        mutation.reset();
      }}
      onLoadMoreAccounts={() => void accountsQuery.fetchNextPage()}
      onPrepareReview={prepareReview}
      onRetry={() => void Promise.all([businesses.refetch(), accountsQuery.refetch()])}
      remoteState={remoteState}
      stage={command ? "review" : "edit"}
    />
  );
}
