import type { CashAccount, PostExpenseRequest } from "@pisto/contracts";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
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
import { isLockedPhase, mutationPhase } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { queryHasStaleData } from "@/lib/query-state";
import { cashApi } from "../cash/api";
import { cashIssueMessages } from "../cash/copy";
import { invalidateExpensesAndCash } from "../cash/invalidate";
import { activeCashAccountsInfiniteOptions, flattenPages } from "../cash/queries";
import { featureRemoteState, refetchEnabled } from "../cash/remote-state";
import { useCashAccess } from "../cash/use-cash-access";
import { expensesBoundaryCopy } from "./copy";
import { buildExpenseCommand } from "./drafts";
import {
  type ExpenseDraft,
  type ExpenseDraftErrors,
  ExpenseEditorScreen,
} from "./expense-editor-screen";
import { expenseHref } from "./expense-history";

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
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const access = useCashAccess("expenses");
  const { business, businesses, canRead } = access;
  const accountsQuery = useInfiniteQuery(
    activeCashAccountsInfiniteOptions(canRead ? business?.id : undefined),
  );
  const accounts = flattenPages(accountsQuery.data);
  const [draft, setDraft] = useState<ExpenseDraft>(emptyDraft);
  const [errors, setErrors] = useState<ExpenseDraftErrors>({});
  const [command, setCommand] = useState<PostExpenseRequest | null>(null);
  const [reviewAccount, setReviewAccount] = useState<CashAccount | null>(null);

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
    mutationFn: cashApi.expenses.post,
    onSuccess: async ({ expense }) => {
      if (business) await invalidateExpensesAndCash(queryClient, business.id);
      notify.success(t("expenses.editor.success"));
      router.replace(expenseHref(expense.id));
    },
  });
  const phase = mutationPhase(mutation);
  const locked = isLockedPhase(phase);

  if (businesses.data && !business) return <Redirect href="/business" />;

  const stale = access.isStale || queryHasStaleData(accountsQuery);
  const canManage =
    access.canManage && Boolean(business?.access.permissions.includes("cash:manage"));
  let state: FeatureRemoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: t("remote.offlineLoad"),
    queries: [businesses, accountsQuery],
    unavailableMessage: t("expenses.remote.unavailable"),
  });
  if (state.kind === "ready" && stale)
    state = { kind: "error", message: t("remote.staleMutation") };
  state = requireFeatureManageAccess(state, canManage);
  const retry = () => void refetchEnabled([businesses, accountsQuery]);

  if (state.kind === "loading") {
    return (
      <Page width="form">
        <ContentSkeleton label={t("expenses.boundary.loading")} variant="form" />
      </Page>
    );
  }
  if (state.kind !== "ready") {
    return (
      <FeatureBoundary copy={expensesBoundaryCopy(t)} onRetry={retry} state={state}>
        {null}
      </FeatureBoundary>
    );
  }

  const canConfirm = canManage && !stale;
  return (
    <ExpenseEditorScreen
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
          ? productErrorMessage(mutation.error, t("expenses.remote.mutationFallback"), t)
          : undefined
      }
      errors={errors}
      formatMoney={(minorUnits, currency) => {
        if (!reviewAccount) throw new Error("An expense review requires its paying account");
        return formatMinorUnits(
          minorUnits,
          currency,
          reviewAccount.currencyMinorUnitDigits,
          locale,
        );
      }}
      onCancel={() => {
        if (!locked) router.replace("/operate/expenses");
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
        setReviewAccount(null);
        mutation.reset();
      }}
      onPrepareReview={() => {
        if (command || !canConfirm) return;
        const result = buildExpenseCommand({
          accounts,
          draft,
          idempotencyKey: Crypto.randomUUID(),
        });
        setErrors(cashIssueMessages(t, result.issues));
        const prepared = result.command;
        if (!prepared) return;
        const account = accounts.find(({ id }) => id === prepared.accountId);
        if (!account) throw new Error("An expense review requires the selected paying account");
        setReviewAccount(account);
        setCommand(prepared);
        mutation.reset();
      }}
      phase={phase}
      reviewAccount={reviewAccount}
    />
  );
}
