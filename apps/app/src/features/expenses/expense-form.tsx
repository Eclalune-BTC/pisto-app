import type { AssistantExpenseDraft, CashAccount, PostExpenseRequest } from "@pisto/contracts";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FeatureBoundary,
  type FeatureRemoteState,
  requireFeatureManageAccess,
} from "@/components/feature-boundary";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { requireSupportedLocale } from "@/i18n/locale";
import type { EntrySource } from "@/lib/entry-source";
import { useKeyedCommand } from "@/lib/keyed-command";
import { currentLocalDateTime, formatMinorUnits, toDecimalString } from "@/lib/money";
import { isLockedPhase } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { flattenPages } from "@/lib/pages";
import { productErrorMessage } from "@/lib/product-errors";
import { queryHasStaleData } from "@/lib/query-state";
import { cashApi } from "../cash/api";
import { cashIssueMessages } from "../cash/copy";
import { invalidateExpensesAndCash } from "../cash/invalidate";
import { activeCashAccountsInfiniteOptions } from "../cash/queries";
import { featureRemoteState, refetchEnabled } from "../cash/remote-state";
import { useCashAccess } from "../cash/use-cash-access";
import { expensesBoundaryCopy } from "./copy";
import { buildExpenseCommand } from "./drafts";
import {
  type ExpenseDraft,
  type ExpenseDraftErrors,
  ExpenseEditorScreen,
} from "./expense-editor-screen";

export type ExpenseFormProps = {
  /** What the assistant resolved from a sentence; every value stays editable before review. */
  draft?: AssistantExpenseDraft;
  /**
   * How the expense was captured. The expense command does not carry it yet; it is sent once
   * the expense contract accepts an entry source.
   */
  entrySource: EntrySource;
  onCancel: () => void;
  onSaved: (expenseId: string) => void;
};

/** Values the assistant resolved; the amount waits for the currency digits of the business. */
function initialDraft(draft: AssistantExpenseDraft | undefined): ExpenseDraft {
  return {
    accountId: draft?.account?.id ?? "",
    amount: "",
    category: draft?.category ?? "other",
    description: draft?.description ?? "",
    localDate: draft?.occurredLocalDate ?? "",
    localTime: draft?.occurredLocalTime ?? "",
    payee: draft?.payee ?? "",
  };
}

/**
 * Registers one paid expense: the form, its review and the keyed command. Routes and the
 * assistant review render it inside their own page.
 */
export function ExpenseForm({ draft: assistantDraft, onCancel, onSaved }: ExpenseFormProps) {
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const access = useCashAccess("expenses");
  const { business, businesses, canRead } = access;
  const accountsQuery = useInfiniteQuery(
    activeCashAccountsInfiniteOptions(canRead ? business?.id : undefined),
  );
  const accounts = flattenPages(accountsQuery.data);
  const [draft, setDraft] = useState<ExpenseDraft>(() => initialDraft(assistantDraft));
  const [errors, setErrors] = useState<ExpenseDraftErrors>({});
  const [command, setCommand] = useState<PostExpenseRequest | null>(null);
  const [reviewAccount, setReviewAccount] = useState<CashAccount | null>(null);
  const [amountSeeded, setAmountSeeded] = useState(false);

  useEffect(() => {
    if (!business) return;
    const now = currentLocalDateTime(business.timeZone);
    setDraft((value) => ({
      ...value,
      localDate: value.localDate || now.date,
      localTime: value.localTime || now.time,
    }));
  }, [business]);

  // The resolved amount is shown once, in the business currency digits; later edits are the user's.
  const draftAmount = assistantDraft?.amountMinorUnits ?? null;
  const digits = business?.currencyMinorUnitDigits;
  useEffect(() => {
    if (amountSeeded || digits === undefined) return;
    setAmountSeeded(true);
    if (draftAmount === null) return;
    setDraft((value) => ({ ...value, amount: toDecimalString(draftAmount, digits) }));
  }, [amountSeeded, digits, draftAmount]);

  const firstAccountId = accounts[0]?.id;
  useEffect(() => {
    if (command || draft.accountId || !firstAccountId) return;
    setDraft((value) => ({ ...value, accountId: firstAccountId }));
  }, [command, draft.accountId, firstAccountId]);

  const mutation = useKeyedCommand({
    mutationFn: cashApi.expenses.post,
    onConfirmed: async ({ expense }) => {
      if (business) await invalidateExpensesAndCash(queryClient, business.id);
      notify.success(t("expenses.editor.success"));
      onSaved(expense.id);
    },
  });
  const phase = mutation.phase;
  const locked = isLockedPhase(phase);

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
    return <ContentSkeleton label={t("expenses.boundary.loading")} variant="form" />;
  }
  if (state.kind !== "ready") {
    return (
      <FeatureBoundary copy={expensesBoundaryCopy(t)} inline onRetry={retry} state={state}>
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
        if (!locked) onCancel();
      }}
      onConfirm={() => {
        if (command && (phase === "uncertain" || (phase !== "pending" && canConfirm))) {
          mutation.send(command);
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
        const messages = cashIssueMessages(t, result.issues);
        // An empty amount is the most common miss, so it says what is missing instead of a rule.
        if (result.issues.amount === "required") {
          messages.amount = t("expenses.editor.amountRequired");
        }
        setErrors(messages);
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
