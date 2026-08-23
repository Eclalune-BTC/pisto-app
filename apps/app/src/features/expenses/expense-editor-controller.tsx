import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { productErrorMessage } from "@/lib/product-errors";
import { cashApi } from "../cash/api";
import { cashIssueMessage } from "../cash/copy";
import { invalidateExpensesAndCash } from "../cash/invalidate";
import { cashConfirmationState } from "../cash/mutation-state";
import { activeCashAccountsInfiniteOptions, flattenPages } from "../cash/queries";
import { featureRemoteState, queryHasStaleData } from "../cash/remote-state";
import { useCashAccess } from "../cash/use-cash-access";
import { buildExpensesCopy } from "./copy";
import { buildExpenseCommand } from "./drafts";
import {
  type ExpenseDraft,
  type ExpenseDraftErrors,
  ExpenseEditorScreen,
} from "./expense-editor-screen";

const emptyDraft: ExpenseDraft = {
  accountId: "",
  amount: "",
  category: "other",
  description: "",
  localDate: "",
  localTime: "",
  payee: "",
};

export function ExpenseEditorController() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const copy = useMemo(() => buildExpensesCopy(t), [t]);
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const {
    business,
    businesses,
    canManage,
    canRead,
    isStale: accessIsStale,
  } = useCashAccess("expenses");
  const businessId = business?.id ?? "unselected";
  const accountsQuery = useInfiniteQuery({
    ...activeCashAccountsInfiniteOptions(businessId),
    enabled: Boolean(business && canRead),
  });
  const accounts = flattenPages(accountsQuery.data);
  const [draft, setDraft] = useState<ExpenseDraft>(emptyDraft);
  const [errors, setErrors] = useState<ExpenseDraftErrors>({});
  const [command, setCommand] = useState<Parameters<typeof cashApi.expenses.post>[0] | null>(null);

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
    const firstAccount = accounts[0];
    if (firstAccount && !draft.accountId) {
      setDraft((value) => ({ ...value, accountId: firstAccount.id }));
    }
  }, [accounts, draft.accountId]);

  const mutation = useMutation({
    mutationFn: cashApi.expenses.post,
    onSuccess: async ({ expense }) => {
      if (!business) return;
      await invalidateExpensesAndCash(queryClient, business.id);
      router.replace({
        pathname: "/operate/expenses/[expenseId]",
        params: { expenseId: expense.id },
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
  const canConfirm =
    canManage && Boolean(business?.access.permissions.includes("cash:manage")) && !stale;
  if (remoteState.kind === "ready" && stale) {
    remoteState = { kind: "error", message: copy.remote.staleMutation };
  }

  const prepareReview = () => {
    const result = buildExpenseCommand({
      accounts,
      draft,
      idempotencyKey: Crypto.randomUUID(),
    });
    setErrors(
      Object.fromEntries(
        Object.entries(result.issues).map(([field, issue]) => [field, cashIssueMessage(t, issue)]),
      ) as ExpenseDraftErrors,
    );
    if (!result.command) return;
    setCommand(result.command);
    mutation.reset();
  };

  const confirmation = cashConfirmationState(mutation);
  return (
    <ExpenseEditorScreen
      accounts={accounts}
      canManage={canConfirm}
      categoryOptions={copy.categoryOptions}
      command={command}
      confirmation={confirmation}
      copy={copy.editor}
      currency={business?.currency ?? ""}
      draft={draft}
      effect={copy.effects.create}
      errorMessage={
        mutation.error
          ? productErrorMessage(mutation.error, copy.remote.mutationFallback, t)
          : undefined
      }
      errors={errors}
      formatMoney={(minorUnits, currency) =>
        formatMinorUnits(minorUnits, currency, business?.currencyMinorUnitDigits ?? 2, locale)
      }
      hasMoreAccounts={Boolean(accountsQuery.hasNextPage)}
      isLoadingMoreAccounts={accountsQuery.isFetchingNextPage}
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
