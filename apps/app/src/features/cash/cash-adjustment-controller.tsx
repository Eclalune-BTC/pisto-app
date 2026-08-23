import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { productErrorMessage } from "@/lib/product-errors";
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
import { activeCashAccountsInfiniteOptions, flattenPages } from "./queries";
import { featureRemoteState, queryHasStaleData } from "./remote-state";
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
  const accounts = flattenPages(accountsQuery.data);
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
    const selectedExists = accounts.some(({ id }) => id === draft.accountId);
    const firstAccount = accounts[0];
    if (!selectedExists && firstAccount) {
      setDraft((value) => ({ ...value, accountId: firstAccount.id }));
    }
  }, [accounts, draft.accountId]);

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

  if (businesses.data && !business) return <Redirect href="/business" />;
  let remoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: copy.remote.offline,
    queries: [businesses, ...(canRead ? [accountsQuery] : [])],
    unavailableMessage: copy.remote.unavailable,
  });
  const stale = accessIsStale || queryHasStaleData(accountsQuery);
  if (remoteState.kind === "ready" && stale) {
    remoteState = { kind: "error", message: copy.remote.staleMutation };
  }

  const prepareReview = () => {
    const result = buildCashAdjustmentCommand({
      account: accounts.find(({ id }) => id === draft.accountId),
      draft,
      idempotencyKey: Crypto.randomUUID(),
    });
    setErrors(
      Object.fromEntries(
        Object.entries(result.issues).map(([field, issue]) => [field, cashIssueMessage(t, issue)]),
      ) as CashAdjustmentErrors,
    );
    if (!result.command) return;
    setCommand(result.command);
    mutation.reset();
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
          accounts.find(({ id }) => id === command?.accountId)?.currencyMinorUnitDigits ??
            business?.currencyMinorUnitDigits ??
            2,
          locale,
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
