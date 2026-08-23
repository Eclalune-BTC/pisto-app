import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { ApiClientError } from "@/lib/api-error";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { productErrorMessage } from "@/lib/product-errors";
import { cashApi } from "../cash/api";
import { cashIssueMessage } from "../cash/copy";
import { invalidateExpensesAndCash } from "../cash/invalidate";
import { cashConfirmationState } from "../cash/mutation-state";
import { cashAccountQueryOptions, expenseQueryOptions } from "../cash/queries";
import { featureRemoteState, queryHasStaleData } from "../cash/remote-state";
import { useCashAccess } from "../cash/use-cash-access";
import { buildExpensesCopy } from "./copy";
import { buildVoidExpenseCommand } from "./drafts";
import {
  ExpenseDetailScreen,
  type VoidExpenseDraft,
  type VoidExpenseDraftErrors,
} from "./expense-detail-screen";

export function ExpenseDetailController() {
  const params = useLocalSearchParams<{
    action?: string | string[];
    expenseId?: string | string[];
  }>();
  const expenseId = Array.isArray(params.expenseId) ? params.expenseId[0] : params.expenseId;
  const action = Array.isArray(params.action) ? params.action[0] : params.action;
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
  const expenseQuery = useQuery({
    ...expenseQueryOptions(businessId, expenseId ?? "missing"),
    enabled: Boolean(business && canRead && expenseId),
  });
  const expense = expenseQuery.data?.expense;
  const accountQuery = useQuery({
    ...cashAccountQueryOptions(businessId, expense?.accountId ?? "missing"),
    enabled: Boolean(business && canRead && expense?.accountId),
  });
  const [stage, setStage] = useState<"detail" | "void-edit" | "void-review">(
    action === "void" ? "void-edit" : "detail",
  );
  const [voidDraft, setVoidDraft] = useState<VoidExpenseDraft>({
    localDate: "",
    localTime: "",
    reason: "",
  });
  const [voidErrors, setVoidErrors] = useState<VoidExpenseDraftErrors>({});
  const [voidCommand, setVoidCommand] = useState<
    Parameters<typeof cashApi.expenses.void>[1] | null
  >(null);

  useEffect(() => {
    if (!business || voidDraft.localDate || voidDraft.localTime) return;
    const current = currentLocalDateTime(business.timeZone);
    setVoidDraft((value) => ({ ...value, localDate: current.date, localTime: current.time }));
  }, [business, voidDraft.localDate, voidDraft.localTime]);

  const mutation = useMutation({
    mutationFn: (command: Parameters<typeof cashApi.expenses.void>[1]) => {
      if (!expenseId) throw new Error("Expense identifier is missing");
      return cashApi.expenses.void(expenseId, command);
    },
    onSuccess: async () => {
      if (!business) return;
      await invalidateExpensesAndCash(queryClient, business.id);
      setStage("detail");
      setVoidCommand(null);
    },
  });

  if (businesses.data && !business) return <Redirect href="/business" />;

  let remoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: copy.remote.offline,
    queries: [businesses, ...(canRead ? [expenseQuery, ...(expense ? [accountQuery] : [])] : [])],
    unavailableMessage: copy.remote.unavailable,
  });
  if (
    expenseQuery.error instanceof ApiClientError &&
    expenseQuery.error.code === "NOT_FOUND" &&
    !expenseQuery.data
  ) {
    remoteState = { kind: "ready" };
  }
  const stale = accessIsStale || queryHasStaleData(expenseQuery) || queryHasStaleData(accountQuery);
  const canConfirm =
    canManage && Boolean(business?.access.permissions.includes("cash:manage")) && !stale;

  const prepareVoidReview = () => {
    const result = buildVoidExpenseCommand({
      draft: voidDraft,
      idempotencyKey: Crypto.randomUUID(),
    });
    setVoidErrors(
      Object.fromEntries(
        Object.entries(result.issues).map(([field, issue]) => [field, cashIssueMessage(t, issue)]),
      ) as VoidExpenseDraftErrors,
    );
    if (!result.command) return;
    setVoidCommand(result.command);
    setStage("void-review");
    mutation.reset();
  };

  const retry = () => {
    void Promise.all([businesses.refetch(), expenseQuery.refetch(), accountQuery.refetch()]);
  };

  return (
    <ExpenseDetailScreen
      accountName={accountQuery.data?.account.name ?? "—"}
      canManage={canConfirm}
      confirmation={cashConfirmationState(mutation)}
      copy={copy.detail}
      errorMessage={
        mutation.error
          ? productErrorMessage(mutation.error, copy.remote.mutationFallback, t)
          : undefined
      }
      expense={expense ?? null}
      formatMoney={(minorUnits, currency, fractionDigits) =>
        formatMinorUnits(minorUnits, currency, fractionDigits, locale)
      }
      isStale={stale}
      onBeginVoid={() => setStage("void-edit")}
      onCancelVoid={() => {
        setStage("detail");
        setVoidCommand(null);
        mutation.reset();
      }}
      onCheckStatus={() => voidCommand && mutation.mutate(voidCommand)}
      onConfirmVoid={() => voidCommand && mutation.mutate(voidCommand)}
      onEditVoid={() => {
        setStage("void-edit");
        mutation.reset();
      }}
      onPrepareVoidReview={prepareVoidReview}
      onRetry={retry}
      onVoidDraftChange={setVoidDraft}
      remoteState={remoteState}
      stage={canConfirm ? stage : "detail"}
      voidCommand={canConfirm ? voidCommand : null}
      voidDraft={voidDraft}
      voidErrors={voidErrors}
    />
  );
}
