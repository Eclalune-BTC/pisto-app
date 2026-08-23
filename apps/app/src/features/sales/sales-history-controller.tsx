import type { Business, SaleStatusFilter } from "@pisto/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocalizedDateTime } from "@/i18n/format";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";

import { featureRemoteState, queryHasStaleData } from "../cash/remote-state";
import { buildSalesHistoryCopy, buildSalesHistoryMessages } from "./copy";
import { salesInfiniteOptions } from "./queries";
import { SalesHistory } from "./sales-history";
import { salesHistoryState } from "./state";

type SalesHistoryControllerProps = {
  accessIsStale: boolean;
  business: Business;
};

export function SalesHistoryController({ accessIsStale, business }: SalesHistoryControllerProps) {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const router = useRouter();
  const copy = useMemo(() => buildSalesHistoryCopy(t), [t]);
  const messages = useMemo(() => buildSalesHistoryMessages(t), [t]);
  const [filter, setFilter] = useState<SaleStatusFilter>("all");
  const canRead = business.access.permissions.includes("sales:read");
  const canCorrect = business.access.permissions.includes("sales:correct");
  const sales = useInfiniteQuery({
    ...salesInfiniteOptions(business.id, filter),
    enabled: canRead,
  });

  const remote = featureRemoteState({
    businessPending: false,
    canRead,
    offlineMessage: messages.offline,
    queries: canRead ? [sales] : [],
    unavailableMessage: messages.unavailable,
  });
  const lastPage = sales.data?.pages.at(-1);
  const state = salesHistoryState({
    canCorrect,
    hasMore: Boolean(sales.hasNextPage),
    items: sales.data?.pages.flatMap(({ items }) => items) ?? [],
    loadingMore: sales.isFetchingNextPage,
    queriedAt: lastPage?.queriedAt,
    remote,
    stale: accessIsStale || queryHasStaleData(sales),
  });

  return (
    <SalesHistory
      copy={copy}
      filter={filter}
      formatDateTime={(value) => formatLocalizedDateTime(value, locale, business.timeZone)}
      formatMoney={(minorUnits, currency, fractionDigits) =>
        formatMinorUnits(minorUnits, currency, fractionDigits, locale)
      }
      formatQueriedAt={(value) =>
        t("sales.list.queriedAt", {
          date: formatLocalizedDateTime(value, locale, business.timeZone),
        })
      }
      onCorrectSale={(saleId) =>
        router.push({ pathname: "/operate/sales/correct/[saleId]", params: { saleId } })
      }
      onFilterChange={setFilter}
      onLoadMore={() => void sales.fetchNextPage()}
      onOpenSale={(saleId) =>
        router.push({ pathname: "/operate/sales/[saleId]", params: { saleId } })
      }
      onRetry={() => void sales.refetch()}
      state={state}
    />
  );
}
