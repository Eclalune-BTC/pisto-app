import type { ExpenseCategory } from "@pisto/contracts";
import type { TFunction } from "i18next";

import type { ExpenseDetailCopy } from "./expense-detail-screen";
import type { ExpenseEditorCopy } from "./expense-editor-screen";
import type { ExpensesScreenCopy } from "./expenses-screen";

export function expenseCategoryLabels(t: TFunction): Record<ExpenseCategory, string> {
  return {
    inventory: t("expenses.categories.inventory"),
    marketing: t("expenses.categories.marketing"),
    other: t("expenses.categories.other"),
    payroll: t("expenses.categories.payroll"),
    rent: t("expenses.categories.rent"),
    tax: t("expenses.categories.tax"),
    transport: t("expenses.categories.transport"),
    utilities: t("expenses.categories.utilities"),
  };
}

export function buildExpensesCopy(t: TFunction) {
  const categories = expenseCategoryLabels(t);
  const boundary = {
    deniedDescription: t("expenses.boundary.deniedDescription"),
    deniedTitle: t("expenses.boundary.deniedTitle"),
    loading: t("expenses.boundary.loading"),
    offlineTitle: t("remote.offlineTitle"),
    retry: t("common.retry"),
    unavailableTitle: t("expenses.boundary.unavailableTitle"),
  };
  const review = {
    confirm: t("expenses.review.confirm"),
    edit: t("common.edit"),
    failedTitle: t("expenses.review.failedTitle"),
    retrySameConfirmation: t("common.retrySameConfirmation"),
    uncertainDescription: t("expenses.review.uncertainDescription"),
    uncertainTitle: t("common.uncertainTitle"),
  };

  const overview = (businessName: string): ExpensesScreenCopy => ({
    ...boundary,
    accountFilter: t("expenses.overview.accountFilter"),
    allAccounts: t("expenses.overview.allAccounts"),
    allCategories: t("expenses.overview.allCategories"),
    allStatuses: t("expenses.overview.allStatuses"),
    applyPeriod: t("expenses.overview.applyPeriod"),
    categories,
    categoryBreakdown: t("expenses.overview.categoryBreakdown"),
    categoryFilter: t("expenses.overview.categoryFilter"),
    description: t("expenses.overview.description", { business: businessName }),
    emptyDescription: t("expenses.overview.emptyDescription"),
    emptyTitle: t("expenses.overview.emptyTitle"),
    endDate: t("expenses.overview.endDate"),
    expensesNotProfit: t("expenses.overview.expensesNotProfit"),
    eyebrow: t("expenses.overview.eyebrow"),
    filtersTitle: t("expenses.overview.filtersTitle"),
    historyTitle: t("expenses.overview.historyTitle"),
    loadMore: t("common.loadMore"),
    loadingMore: t("common.loadingMore"),
    mutationFailedTitle: review.failedTitle,
    noCategoryData: t("expenses.overview.noCategoryData"),
    periodScope: t("expenses.overview.periodScope"),
    periodTotal: t("expenses.overview.periodTotal"),
    posted: t("expenses.overview.posted"),
    postedStatus: t("expenses.overview.postedStatus"),
    recordedExpenses: t("expenses.overview.recordedExpenses"),
    registerExpense: t("expenses.overview.registerExpense"),
    retrySameConfirmation: review.retrySameConfirmation,
    startDate: t("expenses.overview.startDate"),
    statusFilter: t("expenses.overview.statusFilter"),
    title: t("expenses.overview.title"),
    uncertainDescription: review.uncertainDescription,
    uncertainTitle: review.uncertainTitle,
    voidAction: t("expenses.overview.voidAction"),
    voided: t("expenses.overview.voided"),
    voidedStatus: t("expenses.overview.voidedStatus"),
  });

  const editor: ExpenseEditorCopy = {
    ...boundary,
    ...review,
    account: t("expenses.editor.account"),
    accountsEmptyDescription: t("expenses.editor.accountsEmptyDescription"),
    accountsEmptyTitle: t("expenses.editor.accountsEmptyTitle"),
    amount: t("expenses.editor.amount"),
    category: t("expenses.editor.category"),
    createAccount: t("expenses.editor.createAccount"),
    currency: t("expenses.editor.currency"),
    date: t("expenses.editor.date"),
    description: t("expenses.editor.description"),
    eyebrow: t("expenses.editor.eyebrow"),
    loadMore: t("common.loadMore"),
    loadingMore: t("common.loadingMore"),
    newDescription: t("expenses.editor.newDescription"),
    newTitle: t("expenses.editor.newTitle"),
    noPayee: t("expenses.editor.noPayee"),
    payee: t("expenses.editor.payee"),
    payeeOptional: t("expenses.editor.payeeOptional"),
    review: t("expenses.editor.review"),
    reviewDescription: t("expenses.editor.reviewDescription"),
    reviewTitle: t("expenses.editor.reviewTitle"),
    time: t("expenses.editor.time"),
  };

  const detail: ExpenseDetailCopy = {
    ...boundary,
    ...review,
    account: t("expenses.detail.account"),
    amount: t("expenses.detail.amount"),
    cancel: t("common.cancel"),
    categories,
    category: t("expenses.detail.category"),
    date: t("expenses.detail.date"),
    description: t("expenses.detail.description"),
    descriptionLabel: t("expenses.detail.descriptionLabel"),
    eyebrow: t("expenses.detail.eyebrow"),
    noPayee: t("expenses.detail.noPayee"),
    notFoundDescription: t("expenses.detail.notFoundDescription"),
    notFoundTitle: t("expenses.detail.notFoundTitle"),
    payee: t("expenses.detail.payee"),
    posted: t("expenses.detail.posted"),
    reason: t("expenses.detail.reason"),
    reviewVoid: t("expenses.detail.reviewVoid"),
    status: t("expenses.detail.status"),
    time: t("expenses.detail.time"),
    title: t("expenses.detail.title"),
    voidDescription: t("expenses.detail.voidDescription"),
    voidEffect: t("expenses.detail.voidEffect"),
    voidExpense: t("expenses.detail.voidExpense"),
    voidReason: t("expenses.detail.voidReason"),
    voidTitle: t("expenses.detail.voidTitle"),
    voided: t("expenses.detail.voided"),
  };

  return {
    categoryOptions: (Object.entries(categories) as [ExpenseCategory, string][]).map(
      ([value, label]) => ({ label, value }),
    ),
    detail,
    editor,
    effects: { create: t("expenses.effects.create") },
    overview,
    remote: {
      invalidPeriod: t("expenses.remote.invalidPeriod"),
      mutationFallback: t("expenses.remote.mutationFallback"),
      offline: t("remote.offlineLoad"),
      staleMutation: t("remote.staleMutation"),
      unavailable: t("expenses.remote.unavailable"),
    },
  };
}

export type ExpensesCopy = ReturnType<typeof buildExpensesCopy>;
