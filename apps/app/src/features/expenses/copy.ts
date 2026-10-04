import type { ExpenseCategory, ExpenseStatus } from "@pisto/contracts";
import type { TFunction } from "i18next";
import type { FeatureBoundaryCopy } from "@/components/feature-boundary";
import { DEFAULT_LOCALE } from "@/i18n/locale";

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

/** Alphabetical in the catalog language, with the catch-all category last. */
export function expenseCategoryOptions(t: TFunction) {
  const labels = expenseCategoryLabels(t);
  return (Object.keys(labels) as ExpenseCategory[])
    .map((value) => ({ label: labels[value], value }))
    .sort((a, b) =>
      a.value === "other"
        ? 1
        : b.value === "other"
          ? -1
          : a.label.localeCompare(b.label, DEFAULT_LOCALE),
    );
}

export function expenseStatusLabels(t: TFunction): Record<ExpenseStatus, string> {
  return {
    posted: t("expenses.status.posted"),
    voided: t("expenses.status.voided"),
  };
}

export function expensesBoundaryCopy(t: TFunction): FeatureBoundaryCopy {
  return {
    deniedDescription: t("expenses.boundary.deniedDescription"),
    deniedTitle: t("expenses.boundary.deniedTitle"),
    loading: t("expenses.boundary.loading"),
    offlineTitle: t("remote.offlineTitle"),
    retry: t("common.retry"),
    unavailableTitle: t("expenses.boundary.unavailableTitle"),
  };
}
