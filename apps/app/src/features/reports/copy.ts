import { maximumInclusiveDays } from "@pisto/contracts";
import type { TFunction } from "i18next";

import { cashAccountKindLabels, cashAccountStatusLabels } from "@/features/cash/copy";
import { expenseCategoryLabels } from "@/features/expenses/copy";

import type { ReportsScreenCopy } from "./reports-screen";

export function buildReportsCopy(t: TFunction) {
  const screen: ReportsScreenCopy = {
    deniedDescription: t("reports.boundary.deniedDescription"),
    deniedTitle: t("reports.boundary.deniedTitle"),
    description: t("reports.overview.description"),
    eyebrow: t("reports.overview.eyebrow"),
    loading: t("reports.boundary.loading"),
    offlineTitle: t("remote.offlineTitle"),
    range: {
      apply: t("reports.range.apply"),
      applying: t("reports.range.applying"),
      datePlaceholder: t("reports.range.datePlaceholder"),
      description: t("reports.range.description"),
      endLabel: t("reports.range.endLabel"),
      invalidEnd: t("reports.range.invalidEnd"),
      invalidStart: t("reports.range.invalidStart"),
      reversed: t("reports.range.reversed"),
      startLabel: t("reports.range.startLabel"),
      title: t("reports.range.title"),
      tooLong: t("reports.range.tooLong", { days: maximumInclusiveDays }),
    },
    retry: t("common.retry"),
    sections: {
      accountKinds: cashAccountKindLabels(t),
      accountStatuses: cashAccountStatusLabels(t),
      cash: {
        description: t("reports.cash.description"),
        empty: t("reports.cash.empty"),
        inflow: t("reports.cash.inflow"),
        net: t("reports.cash.net"),
        outflow: t("reports.cash.outflow"),
        title: t("reports.cash.title"),
      },
      categories: expenseCategoryLabels(t),
      expenses: {
        amount: t("reports.expenses.amount"),
        description: t("reports.expenses.description"),
        empty: t("reports.expenses.empty"),
        records: t("reports.expenses.records"),
        title: t("reports.expenses.title"),
      },
      metadata: {
        currency: t("common.currency"),
        period: t("reports.metadata.period"),
        queriedAt: t("reports.metadata.queriedAt"),
        through: t("reports.metadata.through"),
        timeZone: t("common.timeZone"),
      },
      period: {
        accountingBoundary: t("reports.period.accountingBoundary"),
        cashInflow: t("reports.period.cashInflow"),
        cashNet: t("reports.period.cashNet"),
        cashOutflow: t("reports.period.cashOutflow"),
        description: t("reports.period.description"),
        expenseCount: t("reports.period.expenseCount"),
        expensesTotal: t("reports.period.expensesTotal"),
        salesCount: t("reports.period.salesCount"),
        salesGross: t("reports.period.salesGross"),
        title: t("reports.period.title"),
        zeroDescription: t("reports.period.zeroDescription"),
        zeroTitle: t("reports.period.zeroTitle"),
      },
      position: {
        description: (localDate: string) => t("reports.position.description", { localDate }),
        lowStockProducts: t("reports.position.lowStockProducts"),
        openReceivables: t("reports.position.openReceivables"),
        outstanding: t("reports.position.outstanding"),
        overdue: t("reports.position.overdue"),
        overdueReceivables: t("reports.position.overdueReceivables"),
        title: t("reports.position.title"),
        trackedProducts: t("reports.position.trackedProducts"),
      },
    },
    title: t("reports.overview.title"),
    unavailableTitle: t("reports.boundary.unavailableTitle"),
  };

  return {
    remote: {
      offline: t("remote.offlineLoad"),
      unavailable: t("reports.remote.unavailable"),
    },
    screen,
  };
}
