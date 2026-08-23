import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { currentLocalDateTime } from "@/lib/money";
import { cashApi } from "../cash/api";
import { formatCashMinorUnits } from "../cash/format";
import { invalidateExpensesAndCash } from "../cash/invalidate";
import { cashConfirmationState } from "../cash/mutation-state";
import { activeCashAccountsInfiniteOptions, flattenPages } from "../cash/queries";
import { featureRemoteState, queryHasStaleData } from "../cash/remote-state";
import { useCashAccess } from "../cash/use-cash-access";
import {
  expenseCategoryOptions,
  expenseEditorCopy,
  expenseErrorMessage,
  expenseIssueMessage,
  expensesUiCopy,
} from "./copy";
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
    offlineMessage: expensesUiCopy.offline,
    queries: [businesses, ...(canRead ? [accountsQuery] : [])],
    unavailableMessage: expensesUiCopy.unavailable,
  });
  const stale = accessIsStale || queryHasStaleData(accountsQuery);
  const canConfirm =
    canManage && Boolean(business?.access.permissions.includes("cash:manage")) && !stale;
  if (remoteState.kind === "ready" && stale) {
    remoteState = { kind: "error", message: expensesUiCopy.staleMutation };
  }

  const prepareReview = () => {
    const result = buildExpenseCommand({
      accounts,
      draft,
      idempotencyKey: Crypto.randomUUID(),
    });
    setErrors(
      Object.fromEntries(
        Object.entries(result.issues).map(([field, issue]) => [field, expenseIssueMessage(issue)]),
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
      categoryOptions={expenseCategoryOptions}
      command={command}
      confirmation={confirmation}
      copy={expenseEditorCopy}
      currency={business?.currency ?? ""}
      draft={draft}
      effect={expensesUiCopy.createEffect}
      errorMessage={mutation.error ? expenseErrorMessage(mutation.error) : undefined}
      errors={errors}
      formatMoney={(minorUnits, currency) =>
        formatCashMinorUnits(
          minorUnits,
          currency,
          business?.currencyMinorUnitDigits ?? 2,
          DEFAULT_LOCALE,
        )
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
