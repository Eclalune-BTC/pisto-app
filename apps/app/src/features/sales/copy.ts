import type { TFunction } from "i18next";

import type { SalesHistoryCopy } from "./sales-history";

export function buildSalesHistoryCopy(t: TFunction): SalesHistoryCopy {
  return {
    correct: t("sales.correction.open"),
    deniedDescription: t("sales.list.deniedDescription"),
    deniedTitle: t("sales.list.deniedTitle"),
    description: t("sales.list.description"),
    emptyDescription: t("sales.list.emptyDescription"),
    emptyTitle: t("sales.list.emptyTitle"),
    filterLabel: t("sales.list.filterLabel"),
    loadMore: t("common.loadMore"),
    loading: t("sales.list.loading"),
    loadingMore: t("common.loadingMore"),
    noDescription: t("common.noDescription"),
    offlineTitle: t("remote.offlineTitle"),
    posted: t("sales.posted"),
    retry: t("common.retry"),
    stale: t("remote.stale"),
    statusAll: t("sales.list.statusAll"),
    statusPosted: t("sales.list.statusPosted"),
    statusVoided: t("sales.list.statusVoided"),
    title: t("sales.list.title"),
    unavailableTitle: t("sales.list.unavailableTitle"),
    voidReason: t("sales.list.voidReason"),
    voided: t("sales.voided"),
  };
}

export function buildSalesHistoryMessages(t: TFunction): {
  offline: string;
  unavailable: string;
} {
  return {
    offline: t("remote.offlineLoad"),
    unavailable: t("sales.list.unavailableDescription"),
  };
}
