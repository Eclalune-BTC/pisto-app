import type { Expense } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";
import { SearchX } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FeatureBoundary } from "@/components/feature-boundary";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { useRouteLabel } from "@/components/shell/shell-context";
import { StatePanel } from "@/components/ui/state-panel";
import { formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { ApiClientError } from "@/lib/api-error";
import { formatMinorUnits } from "@/lib/money";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";
import { cashAccountQueryOptions, expenseQueryOptions } from "../cash/queries";
import { featureRemoteState, refetchEnabled } from "../cash/remote-state";
import { firstParam, type RouteParam } from "../cash/search-params";
import { useCashAccess } from "../cash/use-cash-access";
import { expensesBoundaryCopy } from "./copy";
import { ExpenseDetailScreen } from "./expense-detail-screen";
import { ExpenseVoidDialog } from "./expense-void-dialog";

export function ExpenseDetailController() {
  const params = useLocalSearchParams<{ expenseId?: RouteParam }>();
  const expenseId = firstParam(params.expenseId);
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const access = useCashAccess("expenses");
  const { business, businesses, canRead } = access;
  const businessId = canRead ? business?.id : undefined;
  const expenseQuery = useQuery(expenseQueryOptions(businessId, expenseId));
  // The voided record is fixed when the dialog opens; a refetch cannot change what is confirmed.
  const [voiding, setVoiding] = useState<Expense>();
  const expense = expenseQuery.data?.expense;
  // The screen names the paying account from this same read; a rejection here is a denial too.
  const accountQuery = useQuery(cashAccountQueryOptions(businessId, expense?.accountId));
  useRouteLabel("/operate/expenses/[expenseId]", expense?.description);

  if (businesses.data && !business) return <Redirect href="/business" />;

  const retry = () => void refetchEnabled([businesses, expenseQuery, accountQuery]);
  const notFound =
    !expenseId ||
    (expenseQuery.error instanceof ApiClientError &&
      expenseQuery.error.code === "NOT_FOUND" &&
      !expense);
  const pageState = hasDeniedRead([expenseQuery, accountQuery])
    ? ({ kind: "denied" } as const)
    : featureRemoteState({
        businessPending: businesses.isPending,
        canRead,
        offlineMessage: t("remote.offlineLoad"),
        queries: notFound ? [businesses] : [businesses, expenseQuery],
        unavailableMessage: t("expenses.remote.unavailable"),
      });
  if (pageState.kind === "loading") {
    return (
      <Page width="form">
        <ContentSkeleton label={t("expenses.boundary.loading")} variant="detail" />
      </Page>
    );
  }
  if (pageState.kind !== "ready") {
    return (
      <FeatureBoundary copy={expensesBoundaryCopy(t)} onRetry={retry} state={pageState}>
        {null}
      </FeatureBoundary>
    );
  }
  if (notFound || !expense) {
    return (
      <Page width="form">
        <StatePanel
          description={t("expenses.detail.notFoundDescription")}
          icon={SearchX}
          level={1}
          title={t("expenses.detail.notFoundTitle")}
        />
      </Page>
    );
  }
  if (!business) throw new Error("A readable expense requires the active business");

  const stale = access.isStale || queryHasStaleData(expenseQuery);
  const canVoid = access.canManage && business.access.permissions.includes("cash:manage") && !stale;

  return (
    <>
      <ExpenseDetailScreen
        businessId={business.id}
        canVoid={canVoid}
        expense={expense}
        formatMoney={(minorUnits, currency, fractionDigits) =>
          formatMinorUnits(minorUnits, currency, fractionDigits, locale)
        }
        formatTimestamp={(timestamp, timeZone) =>
          formatLocalizedDateTime(timestamp, locale, timeZone)
        }
        isStale={stale}
        onRetry={retry}
        onVoid={() => setVoiding(expense)}
      />
      {voiding?.id === expense.id ? (
        <ExpenseVoidDialog
          businessId={business.id}
          canConfirm={canVoid}
          expense={voiding}
          onClose={() => setVoiding(undefined)}
          timeZone={business.timeZone}
        />
      ) : null}
    </>
  );
}
